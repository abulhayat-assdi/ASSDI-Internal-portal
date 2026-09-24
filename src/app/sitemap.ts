import { MetadataRoute } from "next";

// Read at request time from the deployed environment. It used to be a
// literal, which silently kept pointing at the old domain after a move.
const BASE_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "localhost:3000"}`;

// Course subdomains are login-only (noindex) and course sites don't have
// public marketing pages anymore — the only public page left is the
// course-directory homepage itself.
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    ];
}
