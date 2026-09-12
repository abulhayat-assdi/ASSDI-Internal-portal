import HeroSection from "@/components/ui/HeroSection";
import StudentVideoTestimonials from "@/components/ui/StudentVideoTestimonials";
import TargetAudience from "@/components/ui/TargetAudience";
import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import { getCmsContent } from "@/lib/getCmsContent";

// This is the old single-institute public homepage, served on the bare root
// domain with no course context. Slated for replacement by the
// course-directory site (multi-tenant Step 5) — until then there's no course
// to scope hero images to.
async function getActiveHeroImages(): Promise<string[]> {
    return [];
}

const navLinks = [
    { label: "Home", href: "/", isActive: true },
    { label: "About", href: "/about" },
    { label: "Module", href: "/modules" },
    { label: "Instructors", href: "/instructors" },
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

export default async function HomePage() {
    const [heroImages, cmsData] = await Promise.all([
        getActiveHeroImages(),
        getCmsContent("home_page"),
    ]);

    type Rec = Record<string, unknown>;
    const d = cmsData as Rec;
    const hero = (d.hero as Rec) ?? {};
    const targetAudience = (d.targetAudience as Rec) ?? {};
    const audienceCards = Array.isArray(d.audienceCards) ? d.audienceCards as { id?: string; iconKey?: string; title: string; description: string }[] : [];

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: "TASM Skill — As-Sunnah Skill Development Institute",
        alternateName: "TASM Skill",
        url: "https://tasm-skill.asf.bd",
        description:
            "আস-সুন্নাহ স্কিল ডেভেলপমেন্ট ইনস্টিটিউটে Sales & Marketing, Digital Marketing, Career Planning সহ ৯টি প্রফেশনাল মডিউল শিখুন।",
        address: {
            "@type": "PostalAddress",
            streetAddress: "আলি নগর গেটের বিপরীত পাশের বিল্ডিং, সাতারকুল রোড, উত্তর বাড্ডা",
            addressLocality: "Dhaka",
            addressRegion: "Dhaka",
            addressCountry: "BD",
        },
        contactPoint: {
            "@type": "ContactPoint",
            telephone: "+8801862534626",
            contactType: "customer service",
            availableLanguage: ["Bengali", "English"],
        },
        hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Sales & Marketing Professional Training",
            itemListElement: [
                { "@type": "Course", name: "Sales Mastery", url: "https://tasm-skill.asf.bd/modules/sales-mastery" },
                { "@type": "Course", name: "Digital Marketing", url: "https://tasm-skill.asf.bd/modules/digital-marketing" },
                { "@type": "Course", name: "Career Planning & Branding", url: "https://tasm-skill.asf.bd/modules/career-planning-branding" },
                { "@type": "Course", name: "AI for Digital Marketers", url: "https://tasm-skill.asf.bd/modules/ai-for-digital-marketers" },
                { "@type": "Course", name: "Business English", url: "https://tasm-skill.asf.bd/modules/business-english" },
            ],
        },
        sameAs: [],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header
                brandText="Sales & Marketing"
                navLinks={navLinks}
                ctaText="Enroll"
                ctaHref="/enroll"
                secondaryCtaText="Login as Teacher"
                secondaryCtaHref="/login"
                studentLoginHref="/student-login"
                transparent={true}
            />
            <main className="min-h-screen bg-slate-50">
                <HeroSection
                    heading={hero.heading as string | undefined}
                    subheading={hero.subheading as string | undefined}
                    primaryButtonText={hero.primaryButtonText as string | undefined}
                    secondaryButtonText={hero.secondaryButtonText as string | undefined}
                    primaryButtonHref="/about"
                    secondaryButtonHref="/modules"
                    heroImages={heroImages}
                />

                <TargetAudience
                    title={(targetAudience.title as string) || "Who This Course Is For"}
                    subtitle={(targetAudience.subtitle as string) || ""}
                    audiences={audienceCards}
                />

                <StudentVideoTestimonials />
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
