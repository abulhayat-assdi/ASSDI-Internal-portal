import { NextRequest, NextResponse } from "next/server";
import { buildLaunch } from "@/lib/pronunciation/launch";

export const dynamic = "force-dynamic";

/**
 * GET /api/pronunciation/launch[?as=staff]
 * Opens the Bangla Pronunciation app as the signed-in portal user. Listed as a
 * public route in middleware so a signed-out browser is sent to the login page
 * (not shown a JSON 401) — the session is checked here instead.
 * The app itself links back here whenever its own session runs out.
 */
export async function GET(req: NextRequest) {
  const asStaff = req.nextUrl.searchParams.get("as") === "staff";
  let result;
  try {
    result = await buildLaunch(req, asStaff);
  } catch (err) {
    console.error("[pronunciation] launch failed", err);
    return page(500, "বাংলা উচ্চারণ এখন খোলা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
  }
  // Relative Location keeps the browser on the course host it came from
  // (request.url is the container's internal address behind the proxy).
  if (result.ok) return redirect(result.location);
  if (result.reason === "signed_out") return redirect(result.loginPath);
  return page(result.status, result.message);
}

function redirect(location: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function page(status: number, message: string) {
  const safe = message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>বাংলা উচ্চারণ</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f7f9;color:#1f2937;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}main{background:#fff;border-radius:12px;padding:28px;max-width:420px;box-shadow:0 1px 3px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 12px}a{color:#2563eb}@media (prefers-color-scheme:dark){body{background:#111827;color:#e5e7eb}main{background:#1f2937}a{color:#93c5fd}}</style></head>
<body><main><h1>বাংলা উচ্চারণ</h1><p>${safe}</p><p><a href="/">পোর্টালে ফিরে যান</a></p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
