import { getAllDefaultContent } from "@/lib/defaultCmsContent";

type DefaultKey = keyof ReturnType<typeof getAllDefaultContent>;

// Server-side CMS helper for the old single-institute public marketing pages
// (/about, /blog, /modules, ...), which are served on the bare root domain
// with no course context. Those pages are slated for replacement by the
// course-directory site (multi-tenant Step 5), so this intentionally does
// not attempt per-course CMS content — it just serves the built-in defaults.
export async function getCmsContent(pageId: string): Promise<Record<string, unknown>> {
    const defaults = getAllDefaultContent();
    return (defaults[pageId as DefaultKey] || {}) as Record<string, unknown>;
}
