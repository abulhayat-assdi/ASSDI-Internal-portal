import { MetadataRoute } from "next";

const BASE_URL = "https://tasm-skill.asf.bd";

// Course subdomains are login-only (noindex) and course sites don't have
// public marketing pages anymore — the only public page left is the
// course-directory homepage itself.
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    ];
}
