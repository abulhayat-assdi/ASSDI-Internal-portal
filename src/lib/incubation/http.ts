import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IncubationError } from "./domain";
import { toBangla } from "./errors-bn";

/** Every error goes out in Bangla (what happened + what to do); the original
 * English stays in `errorEn` for support and logs. */
const reply = (message: string, status: number) =>
  NextResponse.json({ error: toBangla(message), errorEn: message }, { status });

export function failure(error: unknown) {
  if (error instanceof IncubationError) return reply(error.message, error.status);
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
