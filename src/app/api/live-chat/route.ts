import { NextRequest } from "next/server";
import { chatIdentity } from "@/lib/live-chat/access";
import { bootstrap, read, mutate } from "@/lib/live-chat/service";
import { response, failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const ctx = await chatIdentity(req),
      q = req.nextUrl.searchParams;
    return response(
      q.get("kind") === "bootstrap"
        ? await bootstrap(ctx)
        : await read(ctx, q.get("workspaceId") || "", q),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    return response(await mutate(await chatIdentity(req), await req.json()));
  } catch (e) {
    return failure(e);
  }
}
