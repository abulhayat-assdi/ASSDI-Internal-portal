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
  const code = (e as { code?: string })?.code;
  const databaseCode = (e as { meta?: { code?: string } })?.meta?.code;
  console.error("[Live Chat]", {
    name: e instanceof Error ? e.name : "Unknown failure",
    code,
    databaseCode,
  });
  if (
    ["P2021", "P2022", "P1010"].includes(code || "") ||
    (code === "P2010" &&
      ["42P01", "42703", "42501"].includes(databaseCode || ""))
  )
    return response(
      {
        error:
          "Live Chat setup is incomplete. Please contact your course administrator. / লাইভ চ্যাট সেটআপ সম্পূর্ণ হয়নি। কোর্স প্রশাসকের সঙ্গে যোগাযোগ করুন।",
        code: "CHAT_DATABASE_SETUP_REQUIRED",
      },
      503,
    );
  if (["P1001", "P1002", "P2024"].includes(code || ""))
    return response(
      {
        error:
          "Live Chat cannot connect to its database right now. Please retry shortly.",
        code: "CHAT_DATABASE_CONNECTION",
      },
      503,
    );
  return response(
    { error: "Live Chat is temporarily unavailable. Please retry." },
    503,
  );
}
