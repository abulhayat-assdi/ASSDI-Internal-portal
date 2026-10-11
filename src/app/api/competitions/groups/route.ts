import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import type { GroupMember } from "@/lib/competitions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const courseId = req.headers.get("x-course-id");
        if (!courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const batchName = searchParams.get("batchName");
        const competitionId = searchParams.get("competitionId");

        const where: any = { courseId };
        if (batchName) where.batchName = batchName;
        if (competitionId) where.competitionId = competitionId;

        const groups = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionGroup.findMany({
                where,
                orderBy: { groupName: "asc" }
            })
        );

        return NextResponse.json(groups);
    } catch (error) {
        console.error("Failed to fetch competition groups:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden: Only Teachers and Admins can manage groups." }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { id, batchName, competitionId, groupName, members, leaderRoll, deputyRoll } = body;

        if (!batchName || !batchName.trim()) {
            return NextResponse.json({ error: "Batch Name is required" }, { status: 400 });
        }
        if (!groupName || !groupName.trim()) {
            return NextResponse.json({ error: "Group Name is required" }, { status: 400 });
        }

        // Normalise members: unique rolls, and at most one leader and one deputy,
        // who must be two different members.
        const seenRolls = new Set<string>();
        const cleanMembers: GroupMember[] = [];
        for (const m of Array.isArray(members) ? members : []) {
            const roll = String(m?.roll ?? "").trim();
            if (!roll || seenRolls.has(roll)) continue;
            seenRolls.add(roll);
            cleanMembers.push({ roll, name: String(m?.name ?? "") });
        }
        const leader = cleanMembers.find((m) => m.roll === String(leaderRoll ?? "").trim());
        if (leader) leader.isLeader = true;
        const deputy = cleanMembers.find((m) => m.roll === String(deputyRoll ?? "").trim());
        if (deputy && deputy !== leader) deputy.isDeputy = true;

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // A student may belong to only one group per batch.
            const otherGroups = await tx.competitionGroup.findMany({
                where: { courseId, batchName: batchName.trim(), ...(id ? { NOT: { id } } : {}) },
                select: { groupName: true, members: true },
            });
            const conflicts: string[] = [];
            for (const g of otherGroups) {
                for (const m of (Array.isArray(g.members) ? g.members : []) as any[]) {
                    if (seenRolls.has(String(m?.roll))) conflicts.push(`${m.roll} (${g.groupName})`);
                }
            }
            if (conflicts.length > 0) return { conflicts, group: null };

            const data = {
                groupName: groupName.trim(),
                batchName: batchName.trim(),
                competitionId: competitionId || null,
                members: cleanMembers as any,
            };
            if (id) {
                // Update existing group
                const before = await tx.competitionGroup.findFirst({
                    where: { id, courseId },
                    select: { groupName: true, batchName: true },
                });
                const group = await tx.competitionGroup.update({ where: { id, courseId }, data });
                // Reports bucket team rows by team name, so a rename has to
                // carry over to the reports this team already filed.
                if (before && before.groupName !== data.groupName) {
                    await tx.competitionSubmission.updateMany({
                        where: {
                            courseId,
                            competition: { batchName: before.batchName },
                            OR: [
                                { type: "team", groupId: id },
                                { groupId: null, teamName: before.groupName },
                            ],
                        },
                        data: { teamName: data.groupName },
                    });
                }
                return { conflicts: null, group };
            }
            // Create new group
            return { conflicts: null, group: await tx.competitionGroup.create({ data: { courseId, ...data } }) };
        });

        if (result.conflicts) {
            return NextResponse.json(
                { error: `Already in another group: ${result.conflicts.join(", ")}. Remove them from that group first.` },
                { status: 409 }
            );
        }

        return NextResponse.json(result.group);
    } catch (error: any) {
        console.error("Failed to create/update competition group:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
        }

        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionGroup.delete({
                where: { id, courseId }
            })
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete competition group:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
