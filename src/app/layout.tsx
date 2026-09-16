import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { withCourseContext } from "@/lib/db";
import { getCourseById } from "@/lib/course";
import { headers } from "next/headers";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

// The bare root domain (no x-course-id) is the course-directory site and gets
// the institute's own metadata. A course subdomain is just a login portal now —
// no public marketing content — so it gets the course's own name/branding
// and is kept out of search results rather than the old institute's SEO copy.
const PLATFORM_NAME = "As-Sunnah Skill Development Institute";
const PLATFORM_TITLE = "As-Sunnah Skill Development Institute — Internal Portal";
const PLATFORM_DESCRIPTION =
    "Internal course portal for As-Sunnah Skill Development Institute — sign in to your course.";

export async function generateMetadata(): Promise<Metadata> {
    const courseId = (await headers()).get("x-course-id");

    if (!courseId) {
        return {
            title: { default: PLATFORM_TITLE, template: `%s | ${PLATFORM_NAME}` },
            description: PLATFORM_DESCRIPTION,
            robots: { index: true, follow: true },
            icons: { icon: "/favicon.ico" },
        };
    }

    const course = await getCourseById(courseId).catch(() => null);

    let faviconUrl: string | undefined;
    try {
        const cmsRecord = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: "site_settings" } } })
        );
        const cms = cmsRecord?.value as Record<string, unknown> | null;
        // Priority: course.faviconUrl (set by Super Admin) > cms.logoUrl > course.logoUrl > default
        const rawUrl = course?.faviconUrl ?? (cms?.logoUrl as string | undefined) ?? course?.logoUrl ?? undefined;
        if (rawUrl?.startsWith("/api/file?path=")) {
            faviconUrl = "/" + rawUrl.replace("/api/file?path=", "");
        } else if (rawUrl) {
            faviconUrl = rawUrl;
        }
    } catch {
        // use default icon
    }

    const courseName = course?.name ?? "Course Portal";

    return {
        title: { default: courseName, template: `%s | ${courseName}` },
        description: course?.tagline || `Sign in to ${courseName}.`,
        // Login-only portal, no public marketing content — keep it out of search results.
        robots: { index: false, follow: false },
        icons: faviconUrl
            ? { icon: faviconUrl, apple: faviconUrl }
            : { icon: "/favicon.ico" },
    };
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="bn" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
                suppressHydrationWarning
            >
                <AuthProvider>
                    <ConfirmProvider>
                        {children}
                    </ConfirmProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
