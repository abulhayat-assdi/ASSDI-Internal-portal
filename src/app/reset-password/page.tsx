import { getRequestBranding } from "@/lib/branding";
import ResetPasswordPageClient from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
    const brand = await getRequestBranding();
    return <ResetPasswordPageClient brand={brand} />;
}
