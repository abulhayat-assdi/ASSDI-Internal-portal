import { NextRequest } from "next/server";
import { publicRead, publicMutate } from "@/lib/live-chat/public";
import { response, failure } from "@/lib/live-chat/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  try {
    return response(await publicRead(req, (await ctx.params).token));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest, ctx: Context) {
  try {
    const result = await publicMutate(
      req,
      (await ctx.params).token,
      await req.json(),
    );
    if (result && "limited" in result)
      return response(
        { error: "Too many requests. Please wait a minute." },
        429,
      );
    const cookie = result && "cookie" in result ? result.cookie : null;
    const res = response(cookie ? { id: result.id } : result);
    if (cookie)
      res.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "strict",
        path: "/api/live-chat/public/",
        maxAge: 86400,
      });
    return res;
  } catch (e) {
    return failure(e);
  }
}
