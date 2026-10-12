import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { roundMoney } from "@/lib/competitions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Adds a product to the competition's list, or edits one (body.id). Changing
// a price does not touch entries already recorded at the old price.
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;
        const body = await req.json();

        const name = String(body?.name || "").trim().slice(0, 120);
        if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });
        const unitPrice = roundMoney(Number(body?.unitPrice));
        if (!Number.isFinite(Number(body?.unitPrice)) || unitPrice < 0) {
            return NextResponse.json({ error: "Price per piece must be 0 or more." }, { status: 400 });
        }

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

            const competition = await tx.competition.findUnique({ where: { id, courseId }, select: { id: true } });
            if (!competition) return fail("Competition not found", 404);

            const sameName = await tx.competitionProduct.findFirst({
                where: {
                    courseId,
                    competitionId: id,
                    name: { equals: name, mode: "insensitive" },
                    ...(body?.id ? { NOT: { id: String(body.id) } } : {}),
                },
                select: { id: true },
            });
            if (sameName) return fail(`"${name}" is already in the product list.`, 409);

            if (body?.id) {
                const existing = await tx.competitionProduct.findFirst({
                    where: { id: String(body.id), competitionId: id, courseId },
                    select: { id: true },
                });
                if (!existing) return fail("Product not found", 404);
                return NextResponse.json(await tx.competitionProduct.update({ where: { id: existing.id }, data: { name, unitPrice } }));
            }

            return NextResponse.json(await tx.competitionProduct.create({ data: { courseId, competitionId: id, name, unitPrice } }));
        });
    } catch (error) {
        console.error("Failed to save competition product:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;
        const productId = new URL(req.url).searchParams.get("productId");
        if (!productId) return NextResponse.json({ error: "Product ID is required" }, { status: 400 });

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const used = await tx.competitionProcurement.count({ where: { courseId, competitionId: id, productId } });
            if (used > 0) {
                return NextResponse.json(
                    { error: `This product has ${used} procurement ${used === 1 ? "entry" : "entries"}. Delete those first.` },
                    { status: 409 }
                );
            }
            const { count } = await tx.competitionProduct.deleteMany({ where: { id: productId, competitionId: id, courseId } });
            if (count === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 });
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("Failed to delete competition product:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
