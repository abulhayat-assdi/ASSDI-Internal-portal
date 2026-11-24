import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IncubationError } from "./domain";
import { toBangla } from "./errors-bn";

/** Every error goes out in Bangla (what happened + what to do); the original
 * English stays in `errorEn` for support and logs. */
const reply = (message: string, status: number, details?: Record<string, unknown>) =>
  NextResponse.json(
    { error: toBangla(message), errorEn: message, ...(details ? { details } : {}) },
    { status },
  );

/** Context the UI can use to highlight the right entry/line (no free text). */
const DETAIL_KEYS = [
  "code",
  "teamId",
  "teamName",
  "productId",
  "productName",
  "recordId",
  "saleId",
  "lineIndex",
  "lineCount",
  "kind",
  "date",
  "saleDate",
  "needed",
  "inStock",
  "enteredByName",
  "later",
  "rowKey",
  "context",
] as const;
export function errorDetails(details: Record<string, unknown> | undefined) {
  if (!details) return undefined;
  const out = Object.fromEntries(
    DETAIL_KEYS.filter((k) => details[k] !== undefined).map((k) => [k, details[k]]),
  );
  return Object.keys(out).length ? out : undefined;
}

export function failure(error: unknown) {
  if (error instanceof IncubationError)
    return reply(error.message, error.status, errorDetails(error.details));
  if (error instanceof ZodError)
    return reply(
      error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  if (error instanceof SyntaxError) return reply("Send valid JSON data.", 400);
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2002"
  )
    return reply("This already exists. Refresh and check.", 409);
  console.error("Incubation request failed", error);
  return reply("The action could not be completed. Please try again.", 500);
}
