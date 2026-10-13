import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, canManageCompetitions } from "@/lib/auth";
import { loadProcurement } from "@/lib/competitionServer";
import { groupMembers, isValidReportDate, roundMoney, toReportDate } from "@/lib/competitions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Everything the procurement page needs: products, entries and the batch's teams.
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const user = await getSessionUser(req);
        if (!user || !canManageCompetitions(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const competition = await tx.competition.findUnique({
                where: { id, courseId },
                select: { id: true, title: true, batchName: true },
            });
            if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

            return NextResponse.json({ competition, today: toReportDate(), ...(await loadProcurement(tx, courseId, competition)) });
        });
    } catch (error) {
        console.error("Failed to fetch procurement:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Records one handover of a product to a team member, or edits one (body.id).
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const user = await getSessionUser(req);
        if (!user || !canManageCompetitions(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;
        const body = await req.json();

        const quantity = Number(body?.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
            return NextResponse.json({ error: "Quantity must be a whole number of 1 or more." }, { status: 400 });
        }
        const procuredOn = isValidReportDate(body?.procuredOn) ? body.procuredOn : toReportDate();
        const note = String(body?.note || "").trim().slice(0, 500) || null;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

            const competition = await tx.competition.findUnique({ where: { id, courseId }, select: { id: true, batchName: true } });
            if (!competition) return fail("Competition not found", 404);

            const product = await tx.competitionProduct.findFirst({
                where: { id: String(body?.productId || ""), competitionId: id, courseId },
            });
            if (!product) return fail("Please select a product.", 400);

            const group = await tx.competitionGroup.findFirst({
                where: { id: String(body?.groupId || ""), courseId, batchName: competition.batchName },
            });
            if (!group) return fail("Please select a team.", 400);

            const member = groupMembers(group).find((m) => String(m.roll) === String(body?.memberRoll ?? ""));
            if (!member) return fail("Please select a member of that team.", 400);

            // The amount defaults to pieces x price, but staff may override it.
            const hasAmount = body?.totalAmount !== undefined && body?.totalAmount !== null && body?.totalAmount !== "";
            const totalAmount = roundMoney(hasAmount ? Number(body.totalAmount) : quantity * product.unitPrice);
            if (!Number.isFinite(totalAmount) || totalAmount < 0) return fail("Amount must be 0 or more.", 400);

            const paidAmount = roundMoney(Number(body?.paidAmount || 0));
            if (!Number.isFinite(paidAmount) || paidAmount < 0) return fail("Paid amount must be 0 or more.", 400);
            if (paidAmount > totalAmount) return fail("Paid amount cannot be more than the total amount.", 400);

            const data = {
                productId: product.id,
                groupId: group.id,
                groupName: group.groupName,
                memberRoll: String(member.roll),
                memberName: member.name,
                quantity,
                unitPrice: product.unitPrice,
                totalAmount,
                paidAmount,
                procuredOn,
                note,
            };

            if (body?.id) {
                const existing = await tx.competitionProcurement.findFirst({
                    where: { id: String(body.id), competitionId: id, courseId },
                    select: { id: true },
                });
                if (!existing) return fail("Entry not found", 404);
                const entry = await tx.competitionProcurement.update({ where: { id: existing.id }, data });
                return NextResponse.json(entry);
            }

            const entry = await tx.competitionProcurement.create({
                data: { courseId, competitionId: id, recordedBy: user.displayName || user.email, ...data },
            });
            return NextResponse.json(entry);
        });
    } catch (error) {
        console.error("Failed to save procurement entry:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const user = await getSessionUser(req);
        if (!user || !canManageCompetitions(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;
        const entryId = new URL(req.url).searchParams.get("entryId");
        if (!entryId) return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });

        const { count } = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionProcurement.deleteMany({ where: { id: entryId, competitionId: id, courseId } })
        );
        if (count === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete procurement entry:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
