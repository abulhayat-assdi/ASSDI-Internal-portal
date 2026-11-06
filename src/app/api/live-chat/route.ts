import { provision } from "@/lib/customer-service/service";
import { NextRequest } from "next/server";
import { chatIdentity, access } from "@/lib/live-chat/access";
import {
  bootstrap,
  read,
  mutate,
  prepareWorkspace,
} from "@/lib/live-chat/service";
import { response, failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const ctx = await chatIdentity(req),
      q = req.nextUrl.searchParams;
    if (!q.get("kind") || q.get("kind") === "state") {
      const w = q.get("workspaceId") || "";
      if (w) {
        const workspace = await access(ctx, w, false, async (tx) =>
          tx.workspace.findFirst({ where: { id: w }, select: { state: true } }),
        );
        if (workspace?.state === "ACTIVE") await prepareWorkspace(ctx, w);
      }
    }
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
    const ctx = await chatIdentity(req),
      body = await req.json();
    if (body?.action === "provision_workspace") {
      const workspace = await provision(ctx, body.data);
      await prepareWorkspace(ctx, workspace.id);
      return response(workspace);
    }
    return response(await mutate(ctx, body));
  } catch (e) {
    return failure(e);
  }
}
