import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { IncubationError } from "./domain";
export function failure(error: unknown) {
  if (error instanceof IncubationError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "Send valid JSON data." }, { status: 400 });
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "This already exists. Refresh and check." },
      { status: 409 },
    );
  console.error("Incubation request failed", error);
  return NextResponse.json(
    { error: "The action could not be completed. Please try again." },
    { status: 500 },
  );
}
