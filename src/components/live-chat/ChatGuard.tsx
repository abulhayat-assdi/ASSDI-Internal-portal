import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { chatIdentity } from "@/lib/live-chat/access";
import { CrmError } from "@/lib/customer-service/db";
export default async function ChatGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const h = await headers();
    await chatIdentity(
      new NextRequest(
        "http://" +
          (h.get("x-forwarded-host") || h.get("host") || "localhost") +
          "/api/live-chat",
        { headers: new Headers(h) },
      ),
    );
  } catch (e) {
    return (
      <div role="alert" className="p-8">
        <h1>Live Chat Training</h1>
        <p>
          {e instanceof CrmError
            ? e.message
            : "Live Chat access could not be verified. Please retry."}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
