import { MetadataRoute } from "next";

// Same source as sitemap.ts — never hardcode the deployed domain.
const BASE_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "localhost:3000"}`;

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dashboard/",
                    "/student-dashboard/",
                    "/login",
                    "/student-login",
                    "/reset-password",
                    "/api/",
                    "/admin/",
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
