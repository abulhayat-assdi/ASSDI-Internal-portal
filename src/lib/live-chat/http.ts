import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CrmError } from "@/lib/customer-service/db";
export function response(value: unknown, status = 200) {
  return new NextResponse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v)),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function failure(e: unknown) {
  if (e instanceof CrmError) return response({ error: e.message }, e.status);
  if (e instanceof ZodError)
    return response(
      {
        error: e.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      },
      400,
    );
  if ((e as { code?: string })?.code === "P2002")
    return response(
      { error: "This action was already processed. Refresh and retry." },
      409,
    );
  if ((e as { code?: string })?.code === "P2025")
    return response({ error: "Record not found" }, 404);
  console.error("[Live Chat]", e instanceof Error ? e.name : "Unknown failure");
  return response(
    { error: "Live Chat is temporarily unavailable. Please retry." },
    503,
  );
}
