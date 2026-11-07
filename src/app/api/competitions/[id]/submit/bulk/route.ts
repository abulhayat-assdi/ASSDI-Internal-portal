import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getServerSessionUser, canManageCompetitions } from "@/lib/auth";
import {
  findDuplicateDays,
  nonSchemaData,
  normaliseBulkRows,
  stableStringify,
  type BulkRowError,
  type BulkRowInput,
} from "@/lib/competitionBulk";

const MAX_ROWS_PER_SAVE = 1000;

/** Thrown inside the transaction so nothing from a failed save is kept. */
class BulkSaveError extends Error {
  constructor(
    message: string,
    public rowErrors: BulkRowError[] = [],
    public status = 400,
  ) {
    super(message);
  }
}

const snapshot = (s: {
  type: string;
  teamName: string | null;
  rollNumber: string;
  studentName: string;
  reportDate: string | null;
  data: unknown;
}) =>
  ({
    type: s.type,
    teamName: s.teamName,
    rollNumber: s.rollNumber,
    studentName: s.studentName,
    reportDate: s.reportDate,
    data: s.data,
  }) as Prisma.InputJsonValue;

const actorOf = (u: { id: string; displayName?: string; email?: string }) => ({
  actorId: u.id,
  actorName: u.displayName || u.email || u.id,
});

/**
 * Saves the rows the staff grid changed, added or deleted — all of them or
 * none. Every row is validated and normalised (numbers, dates, required
 * answers), a team/student cannot end up with two reports for one day, a row
 * edited by someone else since the grid loaded is refused, and every change
 * is written to competition_submission_revisions.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: compId } = await params;
    const decoded = await getServerSessionUser();

    if (!decoded || !canManageCompetitions(decoded) || !decoded.courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const courseId = decoded.courseId;

    const body = await req.json().catch(() => null);
    const rows: BulkRowInput[] = Array.isArray(body?.submissions) ? body.submissions : [];
    const deletedIds: string[] = Array.isArray(body?.deletedIds)
      ? Array.from(
          new Set<string>(
            body.deletedIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0),
          ),
        )
      : [];
    if (rows.length + deletedIds.length === 0) {
      return NextResponse.json({ error: "There are no changes to save." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS_PER_SAVE) {
      return NextResponse.json(
        { error: `You can save at most ${MAX_ROWS_PER_SAVE} rows at a time.` },
        { status: 400 },
      );
    }

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
      const competition = await tx.competition.findUnique({
        where: { id: compId, courseId, kind: "form" },
      });
      if (!competition) throw new BulkSaveError("Competition not found", [], 404);

      const { rows: changed, errors } = normaliseBulkRows(competition.schema, rows);
      if (errors.length) {
        throw new BulkSaveError("Some rows have errors. Fix the red rows and save again.", errors);
      }

      const existing = await tx.competitionSubmission.findMany({
        where: { competitionId: compId, courseId },
        select: {
          id: true,
          type: true,
          teamName: true,
          rollNumber: true,
          studentName: true,
          reportDate: true,
          submittedAt: true,
          data: true,
          groupId: true,
        },
      });
      const byId = new Map(existing.map((s) => [s.id, s]));

      const ids = changed.filter((r) => r.id).map((r) => r.id!);
      if (new Set(ids).size !== ids.length || ids.some((id) => deletedIds.includes(id))) {
        throw new BulkSaveError("The same row was sent more than once. Reopen the grid.");
      }

      const stale: BulkRowError[] = [];
      for (const row of changed) {
        if (!row.id) continue;
        const current = byId.get(row.id);
        const base = { index: row.index, id: row.id, type: row.type, rollNumber: row.rollNumber };
        if (!current) {
          stale.push({ ...base, message: "This row no longer exists (someone may have deleted it). Reopen the grid." });
        } else if (row.expected !== undefined && row.expected !== stableStringify(current.data)) {
          stale.push({ ...base, message: "Someone else changed this row after you opened the grid. Reopen the grid and edit again." });
        }
      }
      if (deletedIds.some((id) => !byId.has(id))) {
        throw new BulkSaveError("Some rows you deleted no longer exist. Reopen the grid.", [], 409);
      }
      if (stale.length) throw new BulkSaveError("Some rows are out of date.", stale, 409);

      const duplicates = findDuplicateDays(competition.schema, existing, changed, deletedIds);
      if (duplicates.length) {
        throw new BulkSaveError("This would create more than one report for the same day.", duplicates);
      }

      // Keep the team link the student portal uses, when the name matches a group.
      const groups = competition.batchName
        ? await tx.competitionGroup.findMany({
            where: { courseId, batchName: competition.batchName },
            select: { id: true, groupName: true },
          })
        : [];
      const groupIdFor = (teamName: string | null) => {
        if (!teamName) return null;
        const key = teamName.trim().toLowerCase();
        return groups.find((g) => g.groupName.trim().toLowerCase() === key)?.id ?? null;
      };

      const actor = actorOf(decoded);
      const revisions: Prisma.CompetitionSubmissionRevisionCreateManyInput[] = [];

      if (deletedIds.length) {
        await tx.competitionSubmission.deleteMany({
          where: { id: { in: deletedIds }, competitionId: compId, courseId },
        });
        for (const id of deletedIds) {
          revisions.push({
            courseId,
            competitionId: compId,
            submissionId: id,
            action: "deleted",
            before: snapshot(byId.get(id)!),
            ...actor,
          });
        }
      }

      let created = 0;
      let updated = 0;
      for (const row of changed) {
        const values = {
          type: row.type,
          teamName: row.teamName,
          rollNumber: row.rollNumber,
          studentName: row.studentName,
          data: row.data as Prisma.InputJsonValue,
          reportDate: row.reportDate,
        };
        if (row.id) {
          const current = byId.get(row.id)!;
          // Keep data the grid does not show (e.g. absentRolls from the student portal).
          values.data = { ...nonSchemaData(competition.schema, current.data), ...row.data } as Prisma.InputJsonValue;
          const sameTeam = (current.teamName || "").trim() === (row.teamName || "").trim();
          const res = await tx.competitionSubmission.updateMany({
            where: { id: row.id, competitionId: compId, courseId },
            data: {
              ...values,
              groupId: sameTeam && current.groupId ? current.groupId : groupIdFor(row.teamName),
            },
          });
          if (res.count !== 1) throw new BulkSaveError("A row could not be saved. Reopen the grid.", [], 409);
          updated++;
          revisions.push({
            courseId,
            competitionId: compId,
            submissionId: row.id,
            action: "updated",
            before: snapshot(current),
            after: snapshot(values),
            ...actor,
          });
        } else {
          const sub = await tx.competitionSubmission.create({
            data: { ...values, courseId, competitionId: compId, groupId: groupIdFor(row.teamName) },
          });
          created++;
          revisions.push({
            courseId,
            competitionId: compId,
            submissionId: sub.id,
            action: "created",
            after: snapshot(values),
            ...actor,
          });
        }
      }

      if (revisions.length) await tx.competitionSubmissionRevision.createMany({ data: revisions });
      return { created, updated, deleted: deletedIds.length };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof BulkSaveError) {
      return NextResponse.json(
        { error: error.message, rowErrors: error.rowErrors },
        { status: error.status },
      );
    }
    console.error("Error managing bulk submissions:", error);
    return NextResponse.json(
      { error: "Could not save. Nothing was changed — please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: compId } = await params;
    const decoded = await getServerSessionUser();

    if (!decoded || !canManageCompetitions(decoded) || !decoded.courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const courseId = decoded.courseId;

    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
    }

    const found = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
      const current = await tx.competitionSubmission.findFirst({
        where: { id: submissionId, competitionId: compId, courseId },
      });
      if (!current) return false;
      await tx.competitionSubmission.delete({ where: { id: current.id } });
      await tx.competitionSubmissionRevision.create({
        data: {
          courseId,
          competitionId: compId,
          submissionId,
          action: "deleted",
          before: snapshot(current),
          source: "delete",
          ...actorOf(decoded),
        },
      });
      return true;
    });

    if (!found) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting submission:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
