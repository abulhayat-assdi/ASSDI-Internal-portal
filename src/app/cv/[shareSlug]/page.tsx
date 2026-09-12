import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withCourseContext } from "@/lib/db";
import type { TemplateConfig } from "@/lib/cv/constants";
import { SECTION_LABELS } from "@/lib/cv/constants";

// ─── Data fetching (direct Prisma — server component) ────────────────────────

async function getCvData(shareSlug: string) {
    try {
        // Public share link — no course context, super-admin bypass to look
        // up the globally-unique shareSlug.
        const draft = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.cvDraft.findFirst({
                where: { shareSlug, isPublic: true },
                include: { template: { select: { id: true, name: true, slug: true, config: true } } },
            })
        );
        if (!draft) return null;
        // Strip sensitive fields
        const { userId: _u, shareSlug: _s, ...safe } = draft as Record<string, unknown>;
        void _u; void _s;
        return safe;
    } catch {
        return null;
    }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ shareSlug: string }> }): Promise<Metadata> {
    const { shareSlug } = await params;
    const data = await getCvData(shareSlug);
    return {
        title: data?.fullName ? `${data.fullName as string} — CV` : "Shared CV",
        description: (data?.careerObjective as string | undefined) ?? "A professionally crafted CV.",
    };
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ label, color }: { label: string; color: string }) {
    return (
        <h4
            className="font-bold text-sm uppercase tracking-widest pb-2 mb-3"
            style={{ color, borderBottom: `2px solid ${color}` }}
        >
            {label}
        </h4>
    );
}

// ─── CV Viewer ────────────────────────────────────────────────────────────────

function CvViewer({ data, config }: { data: Record<string, unknown>; config: TemplateConfig }) {
    const color = config.sidebarColor;
    const sidebarPct = `${config.sidebarWidth}%`;
    const mainPct = `${100 - config.sidebarWidth}%`;

    const fullName        = data.fullName        as string | undefined;
    const phone           = data.phone           as string | undefined;
    const email           = data.email           as string | undefined;
    const address         = data.address         as string | undefined;
    const profilePhoto    = data.profilePhoto    as string | undefined;
    const careerObjective = data.careerObjective as string | undefined;
    const declaration     = data.declaration     as string | undefined;
    const skills   = (data.skills   as string[] | undefined) ?? [];
    const languages = (data.languages as { name: string; level: string }[] | undefined) ?? [];
    const hobbies  = (data.hobbies  as string[] | undefined) ?? [];
    const workExperience = (data.workExperience as { jobTitle: string; company: string; location?: string; startDate?: string; endDate?: string; bullets?: string[] }[] | undefined) ?? [];
    const training  = (data.training  as { trainingName: string; institute: string; year?: string; bullets?: string[] }[] | undefined) ?? [];
    const education = (data.education as { degree: string; department?: string; institution: string; gpa?: string; year?: string }[] | undefined) ?? [];
    const references = (data.references as { name: string; title?: string; organization?: string; phone?: string; email?: string }[] | undefined) ?? [];

    const sectionOrder: string[] = Array.isArray(data.sectionOrder) && (data.sectionOrder as string[]).length
        ? data.sectionOrder as string[]
        : ["workExperience", "training", "education", "languages", "references", "skills", "hobbies"];

    const initial = fullName?.charAt(0)?.toUpperCase() ?? "?";

    const personalData = [
        { label: "Date of Birth",  value: data.dateOfBirth  as string | undefined },
        { label: "Blood Group",    value: data.bloodGroup   as string | undefined },
        { label: "Religion",       value: data.religion     as string | undefined },
        { label: "Marital Status", value: data.maritalStatus as string | undefined },
        { label: "Nationality",    value: data.nationality  as string | undefined },
    ].filter((f) => f.value);

    function renderMainSection(key: string) {
        switch (key) {
            case "workExperience":
                return workExperience.length ? (
                    <div key="we" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.workExperience} color={color} />
                        {workExperience.map((item, i) => (
                            <div key={i} className="mb-4">
                                <p className="font-bold text-sm text-gray-800">{item.jobTitle}</p>
                                <p className="text-sm text-gray-500">{item.company}{item.location ? ` — ${item.location}` : ""}</p>
                                {(item.startDate || item.endDate) && (
                                    <p className="text-xs text-gray-400 mt-0.5">{item.startDate}{item.startDate && item.endDate ? " – " : ""}{item.endDate}</p>
                                )}
                                {item.bullets?.filter(Boolean).map((b, j) => (
                                    <p key={j} className="text-sm text-gray-600 pl-4 mt-0.5">• {b}</p>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : null;
            case "training":
                return training.length ? (
                    <div key="tr" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.training} color={color} />
                        {training.map((item, i) => (
                            <div key={i} className="mb-4">
                                <p className="font-bold text-sm text-gray-800">{item.trainingName}</p>
                                <p className="text-sm text-gray-500">{item.institute}{item.year ? ` (${item.year})` : ""}</p>
                                {item.bullets?.filter(Boolean).map((b, j) => (
                                    <p key={j} className="text-sm text-gray-600 pl-4 mt-0.5">• {b}</p>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : null;
            case "education":
                return education.length ? (
                    <div key="edu" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.education} color={color} />
                        {education.map((item, i) => (
                            <div key={i} className="mb-4">
                                <p className="font-bold text-sm text-gray-800">{item.degree}{item.department ? ` — ${item.department}` : ""}</p>
                                <p className="text-sm text-gray-500">{item.institution}</p>
                                {(item.gpa || item.year) && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {item.gpa ? `GPA: ${item.gpa}` : ""}{item.gpa && item.year ? " | " : ""}{item.year ?? ""}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : null;
            case "references":
                return references.length ? (
                    <div key="ref" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.references} color={color} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {references.map((ref, i) => (
                                <div key={i}>
                                    <p className="font-bold text-sm text-gray-800">{ref.name}</p>
                                    {ref.title        && <p className="text-sm text-gray-500">{ref.title}</p>}
                                    {ref.organization && <p className="text-sm text-gray-500">{ref.organization}</p>}
                                    {ref.phone        && <p className="text-xs text-gray-400">{ref.phone}</p>}
                                    {ref.email        && <p className="text-xs text-gray-400">{ref.email}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null;
            case "skills":
                return skills.length ? (
                    <div key="sk" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.skills} color={color} />
                        <div className="flex flex-wrap gap-2">
                            {skills.map((s, i) => (
                                <span key={i} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">{s}</span>
                            ))}
                        </div>
                    </div>
                ) : null;
            case "hobbies":
                return hobbies.length ? (
                    <div key="hb" className="mb-5">
                        <SectionHeading label={SECTION_LABELS.hobbies} color={color} />
                        <p className="text-sm text-gray-600">{hobbies.join(" • ")}</p>
                    </div>
                ) : null;
            default: return null;
        }
    }

    return (
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
            {/* Two-column layout: sidebar | main */}
            <div className="flex flex-col md:flex-row min-h-[500px]">
                {/* Sidebar — fixed width on md+, full-width on mobile */}
                <div
                    className="flex-shrink-0 p-6 text-white space-y-5 w-full"
                    style={{ backgroundColor: color, ['--sidebar-w' as string]: sidebarPct }}
                >
                    {/* md: set explicit sidebar width via a wrapper trick */}
                    <div className="hidden md:block" style={{ width: sidebarPct }} aria-hidden />
                    <div className="md:w-auto">
                        {config.showPhoto && (
                            <div
                                className={`mx-auto flex items-center justify-center bg-white/20 border-2 border-white/40 mb-4 overflow-hidden ${config.photoShape === "circle" ? "rounded-full" : "rounded-xl"}`}
                                style={{ width: 80, height: 80 }}
                            >
                                {profilePhoto
                                    ? // eslint-disable-next-line @next/next/no-img-element
                                      <img src={profilePhoto} alt="Profile photo" className="w-full h-full object-cover" />
                                    : <span className="font-black text-3xl text-white">{initial}</span>}
                            </div>
                        )}
                        {fullName && <h2 className="font-black text-xl text-center text-white leading-tight">{fullName}</h2>}

                        {(phone || email || address) && (
                            <div className="mt-4">
                                <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-2">Contact</p>
                                {phone   && <p className="text-white/90 text-sm break-all">{phone}</p>}
                                {email   && <p className="text-white/90 text-sm break-all">{email}</p>}
                                {address && <p className="text-white/90 text-sm">{address}</p>}
                            </div>
                        )}

                        {skills.length > 0 && sectionOrder.includes("skills") && (
                            <div className="mt-4">
                                <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-2">Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {skills.map((s, i) => (
                                        <span key={i} className="bg-white/15 text-white text-xs px-2.5 py-1 rounded-full">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {languages.length > 0 && sectionOrder.includes("languages") && (
                            <div className="mt-4">
                                <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-2">Languages</p>
                                {languages.map((l, i) => (
                                    <div key={i} className="flex justify-between items-center mb-1">
                                        <span className="text-white/90 text-sm">{l.name}</span>
                                        <span className="text-white/60 text-xs">{l.level}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hobbies.length > 0 && sectionOrder.includes("hobbies") && (
                            <div className="mt-4">
                                <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-2">Hobbies</p>
                                <p className="text-white/90 text-sm">{hobbies.join(" • ")}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 p-6 min-w-0">

                    {careerObjective && (
                        <div className="mb-5">
                            <SectionHeading label="Career Objective" color={color} />
                            <p className="text-sm text-gray-600 leading-relaxed">{careerObjective}</p>
                        </div>
                    )}

                    {personalData.length > 0 && (
                        <div className="mb-5">
                            <SectionHeading label="Personal Information" color={color} />
                            <div className="grid grid-cols-2 gap-3">
                                {personalData.map((f, i) => (
                                    <div key={i}>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{f.label}</p>
                                        <p className="text-sm text-gray-700 mt-0.5">{f.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sectionOrder
                        .filter((k) => !["skills", "hobbies", "languages"].includes(k))
                        .map(renderMainSection)}

                    {declaration && (
                        <div className="mb-5">
                            <SectionHeading label="Declaration" color={color} />
                            <p className="text-sm text-gray-600 italic leading-relaxed">{declaration}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicCvPage({ params }: { params: Promise<{ shareSlug: string }> }) {
    const { shareSlug } = await params;
    const data = await getCvData(shareSlug);
    if (!data) notFound();

    const templateRaw = (data as Record<string, unknown>).template as { config?: unknown } | null | undefined;
    const config: TemplateConfig = (templateRaw?.config as TemplateConfig | undefined) ?? {
        primaryColor: "#1e3a5f",
        sidebarColor: "#1e3a5f",
        sidebarWidth: 35,
        fontFamily: "Helvetica",
        photoShape: "circle",
        showPhoto: true,
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Public banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <p className="text-emerald-700 font-medium text-sm">
                            This CV is publicly shared via a unique link.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                            href={`/api/cv/public/${shareSlug}/pdf`}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-xs font-bold rounded-lg hover:bg-[#152d4a] transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PDF
                        </a>
                        <a
                            href={`/api/cv/public/${shareSlug}/docx`}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#059669] text-white text-xs font-bold rounded-lg hover:bg-[#047857] transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download Word
                        </a>
                    </div>
                </div>

                <CvViewer data={data as Record<string, unknown>} config={config} />
            </div>
        </div>
    );
}
