import type { BlogPost } from "@/services/blogService";

// Backs the old single-institute public blog (/blog, /blog/[slug]), served on
// the bare root domain with no course context. Slated for replacement by the
// course-directory site (multi-tenant Step 5) — until then there's no course
// to scope posts to, so these just report "no posts" instead of guessing one.

export async function getPublishedPostsServer(_limitCount?: number): Promise<BlogPost[]> {
    return [];
}

export async function getPostBySlugServer(_slug: string): Promise<BlogPost | null> {
    return null;
}
