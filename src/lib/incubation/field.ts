import "server-only";
import { z } from "zod";
import { isIncubationRunning, isProgramLocked, lockedMessage } from "./lifecycle";
import { Prisma } from "@prisma/client";
import {
  accessProgram,
  audit,
  featureTx,
  settingsSchema,
  isManager,
  isSupervisor,
  type Actor,
} from "./server";
import {
  calculateLedger,
  insist,
  scaled,
  todayDhaka,
  type EntryData,
  type Entry,
} from "./domain";
const position = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  capturedAt: z.string().datetime(),
});
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Field = {
  id: string;
  teamId: string;
  checkIn: Date | string;
  checkOut: Date | string | null;
  carried: unknown;
};
/** Consumption of field custody is FIFO team accounting, not personal sales attribution. */
export function custody(fields: Field[], records: Entry[]) {
  const remaining: Record<string, Record<string, number>> = {};
  const events = [
    ...fields.map((f) => ({
      at: new Date(f.checkIn).getTime(),
      type: "in",
      field: f,
      record: null as Entry | null,
    })),
    ...fields
      .filter((f) => f.checkOut)
      .map((f) => ({
        at: new Date(f.checkOut!).getTime(),
        type: "out",
        field: f,
        record: null as Entry | null,
      })),
    ...records
      .filter(
        (r) =>
          r.status === "posted" &&
          ["sale", "supplier_return", "transfer", "damage"].includes(r.kind),
      )
      .map((r) => ({
        at: new Date(r.createdAt).getTime(),
        type: "sale",
        field: null as Field | null,
        record: r,
      })),
  ].sort((a, b) => a.at - b.at);
  for (const e of events) {
    if (e.type === "in") {
      remaining[e.field!.id] = Object.fromEntries(
        (e.field!.carried as { productId: string; quantity: string }[]).map(
          (l) => [l.productId, scaled(l.quantity, 3)],
        ),
      );
    } else if (e.type === "out") delete remaining[e.field!.id];
    else
      for (const l of e.record!.data.lines || []) {
        let q = scaled(l.quantity, 3);
        for (const f of fields.filter((f) => f.teamId === e.record!.teamId)) {
          const held = remaining[f.id]?.[l.productId] || 0,
            take = Math.min(held, q);
          if (take) {
            remaining[f.id][l.productId] -= take;
            q -= take;
          }
          if (!q) break;
        }
      }
  }
  return remaining;
}
export async function fieldCommand(actor: Actor, input: unknown) {
  const body = z
    .object({
      action: z.enum(["checkin", "checkout", "ping"]),
      programId: z.string(),
      position,
      areaId: z.string().optional(),
      carried: z
        .array(z.object({ productId: z.string(), quantity: z.string() }))
        .max(100)
        .optional(),
      steps: z.number().int().min(0).max(200000).optional(),
      proofId: z.string().optional(),
    })
    .parse(input);
  return featureTx(actor, async (tx) => {
    const { program, member } = await accessProgram(
      tx,
      actor,
      body.programId,
      true,
    );
    insist(
      member && actor.role === "student",
      "Field sessions must be started from the student's own account.",
      403,
    );
    insist(
      body.action !== "checkin" || isIncubationRunning(program),
      "The program is not running.",
    );
    const captured = new Date(body.position.capturedAt),
      now = new Date();
    insist(
      Math.abs(now.getTime() - captured.getTime()) <= 120000,
      "Take a fresh GPS location; old locations are not accepted.",
    );
    const cfg = settingsSchema.parse(program.settings);
    await tx.incubationPosition.deleteMany({
      where: {
        courseId: actor.courseId,
        session: { programId: program.id },
        receivedAt: {
          lt: new Date(now.getTime() - cfg.retentionDays * 86400000),
        },
      },
    });
    let session = await tx.incubationFieldSession.findFirst({
      where: { userId: actor.id, courseId: actor.courseId, checkOut: null },
    });
    if (body.action === "checkin") {
      insist(!session, "Check out of your open session first.", 409);
      insist(
        body.areaId &&
          (await tx.incubationCatalog.findFirst({
            where: {
              id: body.areaId,
              programId: program.id,
              kind: "area",
              active: true,
            },
          })),
        "Select an area.",
      );
      const [products, records, fields] = await Promise.all([
        tx.incubationCatalog.findMany({
          where: { programId: program.id, kind: "product" },
        }),
        tx.incubationRecord.findMany({
          where: {
            programId: program.id,
            status: { in: ["posted", "transfer_pending"] },
          },
        }),
        tx.incubationFieldSession.findMany({
          where: { programId: program.id },
        }),
      ]);
      const ledger = calculateLedger(
          records.map((r) => ({ ...r, data: r.data as EntryData })),
          products,
        ),
        held = custody(
          fields,
          records.map((r) => ({ ...r, data: r.data as EntryData })),
        );
      const requested = new Map<string, number>();
      for (const l of body.carried || []) {
        const p = products.find((p) => p.id === l.productId),
          q = scaled(l.quantity, 3);
        insist(
          p && p.active && q > 0 && (p.fractional || q % 1000 === 0),
          "Invalid product or quantity.",
        );
        requested.set(p.id, (requested.get(p.id) || 0) + q);
      }
      for (const [productId, q] of requested) {
        const reserved = fields
            .filter((f) => f.teamId === member.teamId)
            .reduce((n, f) => n + (held[f.id]?.[productId] || 0), 0),
          transferring = records
            .filter(
              (r) =>
                r.status === "transfer_pending" && r.teamId === member.teamId,
            )
            .reduce(
              (n, r) =>
                n +
                ((r.data as EntryData).lines || [])
                  .filter((l) => l.productId === productId)
                  .reduce((n, l) => n + scaled(l.quantity, 3), 0),
              0,
            );
        insist(
          q <=
            (ledger.stocks[`${member.teamId}|${productId}`]?.quantity || 0) -
              reserved -
              transferring,
          "Not enough team stock after items held by other members or pending transfers.",
        );
      }
      session = await tx.incubationFieldSession.create({
        data: {
          courseId: actor.courseId,
          programId: program.id,
          teamId: member.teamId,
          userId: actor.id,
          userName: actor.displayName,
          startAreaId: body.areaId,
          startPosition: json(body.position),
          carried: json(body.carried || []),
        },
      });
      await audit(tx, actor, program.id, "field.checkin", session.id, null, {
        teamId: session.teamId,
        userName: session.userName,
        startAreaId: session.startAreaId,
        carried: body.carried || [],
      });
    } else {
      insist(
        session &&
          session.programId === program.id &&
          session.teamId === member.teamId,
        "Your open session was not found.",
        404,
      );
      if (body.action === "checkout") {
        insist(
          body.areaId &&
            (await tx.incubationCatalog.findFirst({
              where: {
                id: body.areaId,
                programId: program.id,
                kind: "area",
                active: true,
              },
            })),
          "Select the area you are returning from.",
        );
        // Never trap a user in ongoing tracking: record an exceeded cap as an audited exception.
        const capExceeded =
          cfg.maxFieldHours !== null &&
          (now.getTime() - session.checkIn.getTime()) / 3600000 >
            cfg.maxFieldHours;
        if (body.proofId)
          insist(
            await tx.incubationAttachment.findFirst({
              where: {
                id: body.proofId,
                programId: program.id,
                uploadedBy: actor.id,
              },
            }),
            "Select your own proof file.",
          );
        session = await tx.incubationFieldSession.update({
          where: { id: session.id },
          data: {
            checkOut: now,
            endAreaId: body.areaId,
            endPosition: json(body.position),
            steps: body.steps || 0,
            proofId: body.proofId,
          },
        });
        await tx.incubationAudit.create({
          data: {
            courseId: actor.courseId,
            programId: program.id,
            action: capExceeded
              ? "field.checkout.over_limit"
              : "field.checkout",
            entityId: session.id,
            actorId: actor.id,
            actorName: actor.displayName,
            after: json({
              id: session.id,
              checkIn: session.checkIn,
              checkOut: session.checkOut,
              steps: session.steps,
              startAreaId: session.startAreaId,
              endAreaId: session.endAreaId,
            }),
            reason: capExceeded
              ? "Configured field duration exceeded; tracking stopped and review required."
              : "",
          },
        });
      } else {
        const previous = await tx.incubationPosition.findFirst({
          where: { sessionId: session.id },
          orderBy: { receivedAt: "desc" },
        });
        if (previous && now.getTime() - previous.receivedAt.getTime() < 30000)
          return { session, skipped: true };
      }
    }
    await tx.incubationPosition.upsert({
      where: {
        sessionId_capturedAt: { sessionId: session.id, capturedAt: captured },
      },
      create: {
        courseId: actor.courseId,
        sessionId: session.id,
        capturedAt: captured,
        latitude: body.position.latitude,
        longitude: body.position.longitude,
        accuracy: body.position.accuracy,
      },
      update: {},
    });
    return { session };
  });
}

const fieldChanges = z
  .object({
    checkIn: z.string().datetime(),
    checkOut: z.string().datetime(),
    startAreaId: z.string().min(1),
    endAreaId: z.string().min(1),
    steps: z.number().int().min(0).max(200000),
  })
  .strict();
export async function fieldCorrectionCommand(actor: Actor, input: unknown) {
  const body = z
    .object({
      action: z.enum(["field_correct", "field_review", "field_force_checkout"]),
      programId: z.string(),
      payload: z.record(z.string(), z.unknown()),
    })
    .parse(input);
  return featureTx(actor, async (tx) => {
    const { program } = await accessProgram(tx, actor, body.programId, true),
      p = body.payload;
    if (body.action === "field_force_checkout") {
      // Staff close a session the student forgot to end (allowed in any program state,
      // otherwise the student's next check-in anywhere stays blocked).
      insist(isManager(actor), "Only staff can close another person's field session.", 403);
      const v = z.object({ sessionId: z.string(), reason: z.string().trim().min(3).max(2000) }).parse(p);
      const session = await tx.incubationFieldSession.findFirst({
        where: { id: v.sessionId, programId: program.id, checkOut: null },
      });
      insist(session, "Open session not found.", 404);
      const closed = await tx.incubationFieldSession.update({
        where: { id: session.id },
        data: { checkOut: new Date(), endAreaId: session.startAreaId, version: { increment: 1 } },
      });
      await audit(tx, actor, program.id, "field.force_checkout", session.id, session, closed, v.reason);
      return closed;
    }
    insist(!isProgramLocked(program.status), lockedMessage(program.status), 409);
    insist(
      actor.role !== "student" || body.action !== "field_correct" || isIncubationRunning(program),
      "Entries for this program are closed. Contact your teacher if something needs to change.",
      409,
    );
    const apply = async (
      sessionId: string,
      version: number,
      values: unknown,
      reason: string,
    ) => {
      const v = fieldChanges.parse(values),
        old = await tx.incubationFieldSession.findFirst({
          where: { id: sessionId, programId: program.id },
        });
      insist(
        old && old.version === version,
        "The session has changed; submit a new request.",
        409,
      );
      insist(
        Date.parse(v.checkOut) > Date.parse(v.checkIn) &&
          Date.parse(v.checkOut) <= Date.now() &&
          todayDhaka(new Date(v.checkIn)) >= program.startDate,
        "The check-in/check-out times are not valid.",
      );
      const areas = await tx.incubationCatalog.count({
        where: {
          programId: program.id,
          kind: "area",
          id: { in: [...new Set([v.startAreaId, v.endAreaId])] },
        },
      });
      insist(
        areas === new Set([v.startAreaId, v.endAreaId]).size,
        "Select a valid area.",
      );
      const changed = await tx.incubationFieldSession.update({
        where: { id: old.id },
        data: {
          ...v,
          checkIn: new Date(v.checkIn),
          checkOut: new Date(v.checkOut),
          version: { increment: 1 },
        },
      });
      const snapshot = (x: typeof old) => ({
        checkIn: x.checkIn,
        checkOut: x.checkOut,
        startAreaId: x.startAreaId,
        endAreaId: x.endAreaId,
        steps: x.steps,
        version: x.version,
      });
      await tx.incubationAudit.create({
        data: {
          courseId: actor.courseId,
          programId: program.id,
          action: "field.corrected",
          entityId: old.id,
          actorId: actor.id,
          actorName: actor.displayName,
          reason,
          before: json(snapshot(old)),
          after: json(snapshot(changed)),
        },
      });
      return changed;
    };
    if (body.action === "field_correct") {
      const v = z
        .object({
          sessionId: z.string(),
          version: z.number().int(),
          proposed: fieldChanges,
          reason: z.string().trim().min(3).max(2000),
        })
        .parse(p);
      const old = await tx.incubationFieldSession.findFirst({
        where: { id: v.sessionId, programId: program.id },
      });
      insist(old, "Session not found.", 404);
      insist(
        actor.role !== "student" || old.userId === actor.id,
        "You can only correct your own field sessions.",
        403,
      );
      insist(old.checkOut, "Check out of the session first.");
      insist(old.version === v.version, "The session has changed.", 409);
      if (isManager(actor))
        return apply(old.id, v.version, v.proposed, v.reason);
      const request = await tx.incubationFieldCorrection.create({
        data: {
          courseId: actor.courseId,
          programId: program.id,
          sessionId: old.id,
          expectedVersion: old.version,
          before: json({
            checkIn: old.checkIn,
            checkOut: old.checkOut,
            startAreaId: old.startAreaId,
            endAreaId: old.endAreaId,
            steps: old.steps,
          }),
          proposed: json(v.proposed),
          reason: v.reason,
          requestedBy: actor.id,
          requestedByName: actor.displayName,
        },
      });
      await audit(tx, actor, program.id, "field.correction.requested", old.id, request.before, request.proposed, v.reason);
      return request;
    }
    insist(
      actor.role !== "student" && isSupervisor(actor),
      "You are not allowed to review this.",
      403,
    );
    const v = z
        .object({
          id: z.string(),
          approve: z.boolean(),
          reason: z.string().trim().min(3).max(2000),
        })
        .parse(p),
      request = await tx.incubationFieldCorrection.findFirst({
        where: { id: v.id, programId: program.id },
      });
    insist(
      request && request.status === "pending",
      "This request has already been reviewed.",
      409,
    );
    if (!v.approve)
      await audit(tx, actor, program.id, "field.correction.rejected", request.sessionId, request.before, request.proposed, v.reason);
    if (v.approve)
      await apply(
        request.sessionId,
        request.expectedVersion,
        request.proposed,
        request.reason,
      );
    return tx.incubationFieldCorrection.update({
      where: { id: request.id },
      data: {
        status: v.approve ? "approved" : "rejected",
        reviewedBy: actor.id,
        reviewNote: v.reason,
        reviewedAt: new Date(),
      },
    });
  });
}
