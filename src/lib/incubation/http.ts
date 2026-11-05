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
    return NextResponse.json({ error: "সঠিক JSON ডাটা দিন।" }, { status: 400 });
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "একই তথ্য ইতিমধ্যে আছে। রিফ্রেশ করে দেখুন।" },
      { status: 409 },
    );
  console.error("Incubation request failed", error);
  return NextResponse.json(
    { error: "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।" },
    { status: 500 },
  );
}
