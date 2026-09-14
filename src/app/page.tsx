import Link from "next/link";
import { headers } from "next/headers";
import { GraduationCap, ArrowRight, ShieldCheck, Building2, UserCog } from "lucide-react";
import { listPublicCourses, buildCourseUrl, buildSuperAdminUrl, getCourseById } from "@/lib/course";
import BrandLogo from "@/components/ui/BrandLogo";

export const dynamic = "force-dynamic";

const INSTITUTE_NAME = "As-Sunnah Skill Development Institute";
const PORTAL_LABEL = "Internal Portal";

function courseInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
}

/** Bare root domain (no course context) — the institute's internal course portal. */
async function CourseDirectoryPage() {
    const [courses, hdrs] = await Promise.all([listPublicCourses(), await headers()]);
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
    const adminUrl = buildSuperAdminUrl(host);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="border-b border-slate-200 bg-white">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0 leading-tight">
                            <div className="font-semibold text-slate-900 tracking-tight truncate">
                                {INSTITUTE_NAME}
                            </div>
                            <div className="text-xs text-slate-400">{PORTAL_LABEL}</div>
                        </div>
                    </div>
                    <Link
                        href={adminUrl}
                        className="shrink-0 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Platform admin</span>
                    </Link>
                </div>
            </header>

            <main className="flex-1">
                <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                        {INSTITUTE_NAME}
                    </h1>
                    <p className="mt-3 text-base sm:text-lg text-slate-500 max-w-xl mx-auto">
                        Choose your course below to sign in.
                    </p>
                </section>

                <section className="max-w-6xl mx-auto px-6 pb-20">
                    {courses.length === 0 ? (
                        <div className="flex flex-col items-center text-center py-16 px-6 rounded-2xl border border-dashed border-slate-300 bg-white">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <Building2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                No courses yet
                            </h2>
                            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
                                Once a course is created from the admin panel, it will show up here for its students and teachers to find.
                            </p>
                            <Link
                                href={adminUrl}
                                className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Sign in as platform admin
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {courses.map((course) => {
                                const url = buildCourseUrl(host, course.slug);
                                return (
                                    <a
                                        key={course.slug}
                                        href={url}
                                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
                                    >
                                        <div className="h-1.5" style={{ backgroundColor: course.primaryColor }} />
                                        <div className="p-5 flex flex-col flex-1">
                                            <div className="flex items-center gap-3">
                                                {course.logoUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={course.logoUrl}
                                                        alt={course.name}
                                                        className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold no-gradient"
                                                        style={{ backgroundColor: course.primaryColor }}
                                                    >
                                                        {courseInitial(course.name)}
                                                    </div>
                                                )}
                                                <h3 className="font-semibold text-slate-900 leading-tight">
                                                    {course.name}
                                                </h3>
                                            </div>
                                            <p className="mt-3 text-sm text-slate-500 line-clamp-2 flex-1">
                                                {course.tagline || "A course on this portal."}
                                            </p>
                                            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-1.5 transition-all">
                                                Visit site
                                                <ArrowRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>

            <footer className="border-t border-slate-200 py-6">
                <p className="text-center text-sm text-slate-400">
                    © {new Date().getFullYear()} {INSTITUTE_NAME} — {PORTAL_LABEL}.
                </p>
            </footer>
        </div>
    );
}

// ── Course subdomain homepage ────────────────────────────────────────────────
// No marketing content — just the course's branding and a choice of student
// or teacher/admin login. Course institutes on this platform don't run public
// marketing sites; students and teachers already know their course exists.

async function CourseLoginLandingPage({ courseId }: { courseId: string }) {
    const course = await getCourseById(courseId).catch(() => null);
    const name = course?.name ?? "Course Portal";
    const primaryColor = course?.primaryColor ?? "#1a56db";

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center text-center mb-8">
                    <BrandLogo size={56} logoUrl={course?.logoUrl} primaryColor={primaryColor} />
                    <h1 className="mt-4 text-xl font-bold text-slate-900">{name}</h1>
                    {course?.tagline && (
                        <p className="mt-1 text-sm text-slate-500">{course.tagline}</p>
                    )}
                </div>

                <div className="space-y-3">
                    <Link
                        href="/student-login"
                        className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group"
                    >
                        <span className="flex items-center gap-3">
                            <span
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <GraduationCap className="w-5 h-5" />
                            </span>
                            <span className="font-medium text-slate-900">Login as Student</span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </Link>

                    <Link
                        href="/login"
                        className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group"
                    >
                        <span className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800 text-white">
                                <UserCog className="w-5 h-5" />
                            </span>
                            <span className="font-medium text-slate-900">Login as Teacher / Admin</span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default async function HomePage() {
    const courseId = (await headers()).get("x-course-id");
    return courseId ? <CourseLoginLandingPage courseId={courseId} /> : <CourseDirectoryPage />;
}
