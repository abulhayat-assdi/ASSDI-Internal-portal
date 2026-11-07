import "server-only";
import { formState } from "@/lib/competitions";
import { withCourseContext } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features";
import { canManageCompetitions } from "@/lib/auth";
import { resolveStudent, resolveTeam } from "@/lib/competitionServer";
import { isManager, type Actor } from "@/lib/incubation/server";
import { incubationState } from "@/lib/incubation/lifecycle";
import { insist } from "@/lib/incubation/domain";

export async function competitionDirectory(actor: Actor, student = false) {
  insist(
    student
      ? actor.role === "student"
      : isManager(actor) || canManageCompetitions(actor),
    "অনুমতি নেই।",
    403,
  );
  return withCourseContext(
    { courseId: actor.courseId, isSuperAdmin: false },
    async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: actor.courseId },
        select: { settings: true },
      });
      const identity = student
        ? await resolveStudent(tx, actor, actor.courseId)
        : null;
      if (student && !identity)
        return {
          competitions: [],
          team: null,
          canCreateIncubation: false,
          canCreateForm: false,
        };
      const own = identity
        ? await tx.batchStudent.findUnique({
            where: {
              courseId_batchName_roll: {
                courseId: actor.courseId,
                batchName: identity.batchName,
                roll: identity.roll,
              },
            },
            select: { id: true },
          })
        : null;
      const forms =
        isFeatureEnabled(course?.settings, "competitions") &&
        (student || canManageCompetitions(actor))
          ? await tx.competition.findMany({
              where: {
                kind: "form",
                ...(identity ? { batchName: identity.batchName } : {}),
              },
              orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
            })
          : [];
      const programs = isFeatureEnabled(course?.settings, "business_incubation")
        ? await tx.incubationProgram.findMany({
            where: {
              deletedAt: null,
              ...(student
                ? {
                    status: { not: "draft" },
                    batchNames: { array_contains: [identity!.batchName] },
                  }
                : {}),
            },
            include: {
              teams: {
                where: student
                  ? {
                      active: true,
                      members: { some: { studentId: own?.id || "__none__" } },
                    }
                  : {},
                include: {
                  members: {
                    where: student ? { studentId: own?.id || "__none__" } : {},
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];
      const competitions = [
        ...forms.map((c) => ({
          ...c,
          kind: "form",
          state: formState(c),
          batchNames: [c.batchName],
          canOpen: true,
        })),
        ...programs
          .map((p) => ({
            id: p.competitionId,
            programId: p.id,
            title: p.name,
            description: p.description,
            kind: "business_incubation",
            batchNames: p.batchNames,
            state: incubationState(p),
            isActive: incubationState(p) === "running",
            startDate: p.startDate,
            endDate: p.endDate,
            createdAt: p.createdAt,
            team: p.teams[0]
              ? {
                  name: p.teams[0].name,
                  role: p.teams[0].members[0]?.isLead ? "leader" : "member",
                }
              : null,
            canOpen: !student || !!p.teams.length,
          }))
          .filter(
            (c) =>
              !student ||
              c.state === "running" ||
              (c.canOpen && ["ended", "closed", "closing"].includes(c.state)),
          ),
      ];
      const group = identity
        ? await resolveTeam(tx, actor.courseId, identity)
        : null;
      return {
        competitions,
        team: group?.group
          ? { groupName: group.group.groupName, role: group.role }
          : null,
        canCreateIncubation:
          !student &&
          isManager(actor) &&
          isFeatureEnabled(course?.settings, "business_incubation"),
        canCreateForm:
          !student &&
          canManageCompetitions(actor) &&
          isFeatureEnabled(course?.settings, "competitions"),
      };
    },
  );
}
