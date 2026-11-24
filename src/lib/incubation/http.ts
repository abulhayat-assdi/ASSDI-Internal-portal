import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IncubationError } from "./domain";
import { toBangla } from "./errors-bn";

/** Every error goes out in Bangla (what happened + what to do); the original
 * English stays in `errorEn` for support and logs. */
const reply = (
  message: string,
  status: number,
  details?: Record<string, unknown>,
) =>
  NextResponse.json(
    { error: toBangla(message), errorEn: message, ...(details ? { details } : {}) },
    { status },
  );

export function failure(error: unknown) {
  if (error instanceof IncubationError) {
    // Only the error code and product go back, so a form can point at the
    // product line that ran short.
    const d = error.details;
    const details =
      d && (typeof d.code === "string" || typeof d.productId === "string")
        ? {
            ...(typeof d.code === "string" ? { code: d.code } : {}),
            ...(typeof d.productId === "string" ? { productId: d.productId } : {}),
          }
        : undefined;
    return reply(error.message, error.status, details);
  }
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
