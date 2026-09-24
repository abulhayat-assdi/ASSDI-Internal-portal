import { getRequestBranding } from "@/lib/branding";
import LoginPageClient from "./LoginForm";

// Server component so the course's own name and logo are already in the HTML
// on first paint — the branding comes from the Course row the subdomain
// resolves to, never from a hardcoded course.
export default async function LoginPage() {
    const brand = await getRequestBranding();
    return <LoginPageClient brand={brand} />;
}
