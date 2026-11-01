import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { identity } from "@/lib/customer-service/access";
import { CrmError } from "@/lib/customer-service/db";
export default async function CrmGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost";
  try {
    await identity(
      new NextRequest("http://" + host + "/api/crm", {
        headers: new Headers(requestHeaders),
      }),
    );
  } catch (e) {
    return (
      <div role="alert" className="p-8">
        <h1 className="text-xl font-semibold">Customer Service CRM</h1>
        <p className="mt-3">
          {e instanceof CrmError
            ? e.message
            : "CRM access could not be verified. Please retry."}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
