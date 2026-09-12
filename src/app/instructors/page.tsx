import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import InstructorCard from "@/components/ui/InstructorCard";
import Link from "next/link";
import { getServerSessionUser, isAdmin as checkIsAdmin } from "@/lib/auth";

import { getImageUrl } from "@/lib/getImageUrl";
import { getCmsContent } from "@/lib/getCmsContent";

interface Teacher {
    id: string;
    name: string;
    designation: string;
    about: string;
    email: string;
    profileImageUrl: string;
    [key: string]: unknown;
}

export const dynamic = "force-dynamic";

const TEACHER_IMAGES: Record<string, string> = {
    "Golam Kibria": "instructors/golam-kibria.jpeg",
    "Shaibal Shariar": "instructors/shaibal-shariar.jpg",
    "Mohammad Abu Zabar Rezvhe": "instructors/abu-zabar-rezvhe.jpg",
    "Md. Nesar Uddin": "instructors/nesar-uddin.jpg",
    "Abul Hayat": "instructors/abul-hayat.jpg",
    "M M Naim Amran": "instructors/naim-amran.jpg",
};

async function getAdminStatus() {
    try {
        const user = await getServerSessionUser();

        return !!user && checkIsAdmin(user);
    } catch (e) {
        return false;
    }
}

// This is the old single-institute public instructors page, served on the
// bare root domain with no course context. Slated for replacement by the
// course-directory site (multi-tenant Step 5) — until then there's no course
// to scope teachers to.
async function getTeachers(): Promise<Teacher[]> {
    try {
        const teachers: any[] = [];

        return teachers.map((data) => {
            let profileImageUrl = data.profileImageUrl || "";
            // Fallback to public images if profileImageUrl is missing
            if (!profileImageUrl && TEACHER_IMAGES[data.name]) {
                profileImageUrl = getImageUrl(TEACHER_IMAGES[data.name]);
            }
            return {
                ...data,
                profileImageUrl,
            } as unknown as Teacher;
        });
    } catch (error) {
        console.error("Error fetching teachers from Prisma:", error);
        return [];
    }
}

export default async function InstructorsPage() {
    const [instructors, isAdmin, cmsData] = await Promise.all([
        getTeachers(),
        getAdminStatus(),
        getCmsContent("instructors_page"),
    ]);
    const pageHeader = (cmsData as Record<string, Record<string, string>>).header ?? {};

    const navLinks = [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
        { label: "Module", href: "/modules" },
        { label: "Instructors", href: "/instructors", isActive: true },
        { label: "Success Stories", href: "/success-stories" },
        { label: "Contact & Q&A", href: "/contact" },
        { label: "Blog", href: "/blog" },
    ];

    const footerLinkGroups = [
        {
            title: "Navigation",
            links: [
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
                { label: "Module", href: "/modules" },
                { label: "Instructors", href: "/instructors" },
            ],
        },
        {
            title: "Support",
            links: [
                { label: "Success Stories", href: "/success-stories" },
                { label: "Contact & Q&A", href: "/contact" },
                { label: "Enroll / Learn More", href: "/enroll" },
            ],
        },
    ];

    return (
        <>
            <Header
                brandText="Sales & Marketing"
                navLinks={navLinks}
                ctaText="Enroll"
            />

            <main className="min-h-screen bg-slate-50 flex flex-col">
                {/* Clean Page Header */}
                <div className="pt-8 md:pt-10 pb-6 w-full max-w-7xl mx-auto px-6 lg:px-8 text-center relative">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#111827] mb-3 tracking-tight">
                        {pageHeader.title || "Meet Our Team"}
                    </h1>
                    <p className="text-lg md:text-xl text-[#4b5563] leading-relaxed max-w-2xl mx-auto font-medium">
                        {pageHeader.subtitle || "Dedicated professionals committed to helping you grow with practical skills and ethical values."}
                    </p>

                    {isAdmin && (
                        <div className="mt-6">
                            <Link
                                href="/dashboard/teachers"
                                className="inline-flex items-center gap-2 px-6 py-2 bg-[#059669] text-white font-bold rounded-full hover:bg-[#10b981] transition-all shadow-md"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Instructors Content
                            </Link>
                        </div>
                    )}
                </div>

                {/* Instructors Grid Section */}
                <section className="w-full pb-16 md:pb-24 flex-grow relative z-20">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {instructors.map((instructor: Teacher) => (
                                <InstructorCard
                                    key={instructor.id}
                                    name={instructor.name}
                                    role={instructor.designation}
                                    description={instructor.about}
                                    email={instructor.email}
                                    image={instructor.profileImageUrl}
                                />
                            ))}
                        </div>
                        {instructors.length === 0 && (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-gray-500 text-lg">No instructors found.</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <Footer
                brandName="Sales & Marketing"
                brandDescription="A professional learning platform focused on practical sales, marketing, and ethical growth."
                linkGroups={footerLinkGroups}
                copyrightText="© 2026 Sales & Marketing. All rights reserved."
            />
        </>
    );
}
