import { getRequestBranding } from "@/lib/branding";
import StudentLoginForm from "./StudentLoginForm";

export default async function StudentLoginPage() {
    const brand = await getRequestBranding();
    return <StudentLoginForm brand={brand} />;
}
