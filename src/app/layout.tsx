import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import MobileBottomNav from "@/components/ui/MobileBottomNav";
import { withCourseContext } from "@/lib/db";
import { headers } from "next/headers";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const SITE_URL = "https://tasm-skill.asf.bd";
const SITE_NAME = "TASM Skill";
const SITE_TITLE = "Sales & Marketing";
const SITE_DESCRIPTION =
    "আস-সুন্নাহ স্কিল ডেভেলপমেন্ট ইনস্টিটিউটে Sales & Marketing, Digital Marketing, Career Planning সহ ৯টি প্রফেশনাল মডিউল শিখুন। বাংলাদেশের সেরা ব্যবহারিক ট্রেনিং প্রোগ্রাম।";

export async function generateMetadata(): Promise<Metadata> {
    let faviconUrl: string | undefined;
    try {
        const courseId = (await headers()).get("x-course-id");
        if (!courseId) throw new Error("no course context (root domain)");

        const cmsRecord = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: "site_settings" } } })
        );
        const cms = cmsRecord?.value as Record<string, unknown> | null;
        const logoUrl = cms?.logoUrl as string | undefined;
        // Convert /api/file?path=uploads/... → /uploads/... (static public path, no auth needed)
        if (logoUrl?.startsWith("/api/file?path=")) {
            faviconUrl = "/" + logoUrl.replace("/api/file?path=", "");
        } else if (logoUrl) {
            faviconUrl = logoUrl;
        }
    } catch {
        // use default icon
    }

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: SITE_TITLE,
            template: `%s | ${SITE_NAME}`,
        },
        description: SITE_DESCRIPTION,
        keywords: [
            "TASM Skill",
            "As-Sunnah Skill Development",
            "sales marketing course Bangladesh",
            "সেলস মার্কেটিং কোর্স",
            "ডিজিটাল মার্কেটিং কোর্স ঢাকা",
            "digital marketing training Bangladesh",
            "career development course Bangladesh",
            "sales training Dhaka",
            "marketing course Bangladesh",
            "ASF skill Bangladesh",
        ],
        authors: [{ name: "TASM Skill — As-Sunnah Foundation" }],
        openGraph: {
            type: "website",
            locale: "bn_BD",
            url: SITE_URL,
            siteName: SITE_NAME,
            title: SITE_TITLE,
            description: SITE_DESCRIPTION,
            images: [
                {
                    url: "/og-image.png",
                    width: 1200,
                    height: 630,
                    alt: "TASM Skill — Sales & Marketing Training Bangladesh",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: SITE_TITLE,
            description: SITE_DESCRIPTION,
            images: ["/og-image.png"],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-video-preview": -1,
                "max-image-preview": "large",
                "max-snippet": -1,
            },
        },
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
            <head>
                <style>{`
                    :root {
                        --tenant-primary: #1a56db;
                        --tenant-accent: #f3f4f6;
                    }
                `}</style>
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
                suppressHydrationWarning
            >
                <AuthProvider>
                    <ConfirmProvider>
                        {children}
                        <MobileBottomNav />
                    </ConfirmProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
