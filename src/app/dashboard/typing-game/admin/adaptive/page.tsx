import { redirect } from "next/navigation";

/** The old attempt-based analytics page moved to /analytics. */
export default function AdminAdaptivePage() {
  redirect("/dashboard/typing-game/admin/analytics");
}
