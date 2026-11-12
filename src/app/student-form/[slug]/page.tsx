import { getBrandingForCourseId, getRequestBranding } from "@/lib/branding";
import { withCourseContext } from "@/lib/db";
import StudentFormClient from "./StudentFormClient";

export default async function StudentFormPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    // The form belongs to one course, whatever domain the link was opened on,
    // so brand the page from the form's own course — not the request host.
    const form = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.batchForm.findUnique({ where: { formSlug: slug }, select: { courseId: true } })
    ).catch(() => null);

    const brand = form?.courseId
        ? await getBrandingForCourseId(form.courseId)
        : await getRequestBranding();

    return <StudentFormClient brand={brand} />;
}
