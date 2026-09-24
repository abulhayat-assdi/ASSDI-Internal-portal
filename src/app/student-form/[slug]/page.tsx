import { getRequestBranding } from "@/lib/branding";
import StudentFormClient from "./StudentFormClient";

export default async function StudentFormPage() {
    const brand = await getRequestBranding();
    return <StudentFormClient brand={brand} />;
}
