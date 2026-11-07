import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { IncubationProgram, IncubationRecord, Prisma } from "@prisma/client";
import { IncubationError, insist, type EntryData } from "./domain";

type Tx = Prisma.TransactionClient;

/** Kinds staff can add from the sheet. Purchases need a voucher; refunds/transfers link to other records. */
export const SHEET_CREATABLE = [
  "sale",
  "expense",
  "supplier_return",
  "damage",
  "fund",
  "repayment",
  "cash_count",
  "fgd",
  "insight",
] as const;

export interface SheetDeps {
  tx: Tx;
  actor: { id: string; displayName: string; courseId: string };
  program: IncubationProgram;
  entrySchema: z.ZodTypeAny;
  validate: (r: Pick<IncubationRecord, "id" | "teamId" | "targetTeamId" | "date" | "kind"> & { data: unknown }) => Promise<EntryData>;
  recompute: () => Promise<unknown>;
  audit: (action: string, entityId: string, before: unknown, after: unknown, reason: string) => Promise<unknown>;
  json: (v: unknown) => Prisma.InputJsonValue;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Applies a whole sheet save — new rows, edited rows and deleted rows — in
 * the caller's transaction. Each row is validated with the normal entry
 * rules; the ledger is recomputed once at the end so stock can never go
 * negative. Any failure throws, which rolls the whole save back. Errors name
 * the row as "[[rowKey]] message" so the sheet can highlight it.
 */
export async function sheetSave(deps: SheetDeps, payload: unknown) {
  const { tx, actor, program } = deps;
  const v = z
    .object({
      reason: z.string().trim().min(3).max(2000),
      creates: z
        .array(
          z.object({
            key: z.string().max(100),
            kind: z.enum(SHEET_CREATABLE),
            teamId: z.string().min(1),
            // Date and data are checked per row below, so errors can name the row.
            date: z.string(),
            data: z.unknown(),
          }),
        )
        .max(300)
        .default([]),
      updates: z
        .array(
          z.object({
            key: z.string().max(100),
            recordId: z.string().min(1),
            version: z.number().int().positive(),
            date: z.string(),
            data: z.unknown(),
          }),
        )
        .max(300)
        .default([]),
      voids: z
        .array(z.object({ recordId: z.string().min(1), version: z.number().int().positive() }))
        .max(300)
        .default([]),
    })
    .parse(payload);
  insist(v.creates.length + v.updates.length + v.voids.length > 0, "There are no changes to save.");
  const ids = [...v.updates.map((u) => u.recordId), ...v.voids.map((x) => x.recordId)];
  insist(new Set(ids).size === ids.length, "The same entry was sent more than once. Reopen the sheet and try again.");

  const row = async <T>(key: string, fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof IncubationError) throw new IncubationError(`[[${key}]] ${message}`, e.status);
      if (e instanceof z.ZodError) {
        const issue = e.issues[0];
        const field = issue?.path?.filter((x) => typeof x === "string").pop();
        throw new IncubationError(
          `[[${key}]] ${field ? `"${field}": ` : ""}${issue?.message || "Some values in this row are not valid."}`,
          400,
        );
      }
      throw e;
    }
  };

  for (const x of v.voids) {
    const old = await tx.incubationRecord.findFirst({ where: { id: x.recordId, programId: program.id } });
    insist(
      old && old.status === "posted" && old.version === x.version,
      `A deleted entry (${x.recordId.slice(0, 8)}) was changed by someone else meanwhile. Reopen the sheet.`,
      409,
    );
    const changed = await tx.incubationRecord.update({
      where: { id: old.id },
      data: { status: "void", version: { increment: 1 } },
    });
    await deps.audit("record.sheet_voided", old.id, old, changed, v.reason);
  }

  for (const u of v.updates) {
    await row(u.key, async () => {
      const old = await tx.incubationRecord.findFirst({ where: { id: u.recordId, programId: program.id, status: "posted" } });
      insist(old && old.version === u.version, "This entry was changed by someone else. Reopen the sheet.", 409);
      const date = day.parse(u.date);
      const data = await deps.validate({ ...old, date, data: deps.entrySchema.parse(u.data) });
      const changed = await tx.incubationRecord.update({
        where: { id: old.id },
        data: { date, data: deps.json(data), version: { increment: 1 } },
      });
      await deps.audit("record.sheet_corrected", old.id, old, changed, v.reason);
    });
  }

  let created = 0;
  for (const c of v.creates) {
    await row(c.key, async () => {
      const team = await tx.incubationTeam.findFirst({ where: { id: c.teamId, programId: program.id } });
      insist(team, "Choose a team for this row.");
      // A retried or double-clicked save must not add the same row twice.
      const requestKey = `sheet:${c.key}`;
      const existing = await tx.incubationRecord.findUnique({
        where: { programId_enteredBy_requestKey: { programId: program.id, enteredBy: actor.id, requestKey } },
        select: { id: true },
      });
      if (existing) return;
      const date = day.parse(c.date);
      const input = deps.entrySchema.parse(c.data) as Record<string, unknown>;
      if (c.kind === "fgd" || c.kind === "insight") {
        const sprint = await tx.incubationSprint.findFirst({
          where: { programId: program.id, teamId: c.teamId, startDate: { lte: date }, endDate: { gte: date } },
          select: { categoryId: true },
        });
        if (sprint) input.categoryId = sprint.categoryId;
      }
      const data = await deps.validate({ id: "new", teamId: c.teamId, targetTeamId: null, kind: c.kind, date, data: input });
      const record = await tx.incubationRecord.create({
        data: {
          courseId: actor.courseId,
          programId: program.id,
          teamId: c.teamId,
          kind: c.kind,
          date,
          data: deps.json(data),
          requestKey,
          requestHash: createHash("sha256").update(JSON.stringify(c)).digest("hex"),
          enteredBy: actor.id,
          enteredByName: actor.displayName,
          status: "posted",
        },
      });
      created++;
      await deps.audit("record.sheet_created", record.id, null, record, v.reason);
    });
  }

  try {
    await deps.recompute();
  } catch (e) {
    if (e instanceof IncubationError)
      throw new IncubationError(
        `These changes would break the stock or cash rules: ${e.message} Check quantities and dates of the rows you changed.`,
        e.status,
      );
    throw e;
  }
  return { created, updated: v.updates.length, voided: v.voids.length };
}
