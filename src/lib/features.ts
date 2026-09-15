export interface FeatureDefinition {
    key: string;
    label: string;
    description: string;
    /** Default visibility when the course has no explicit toggle stored.
     *  - Existing features: true (backward compatible — সব চালু থাকবে)
     *  - Any NEW feature added later without this flag: false (ডিফল্ট OFF,
     *    সুপার-এডমিন টগল অন না করা পর্যন্ত দেখাবে না) */
    defaultEnabled?: boolean;
}

export const ALL_FEATURES: FeatureDefinition[] = [
    { key: 'homework', label: 'হোমওয়ার্ক', description: 'হোমওয়ার্ক জমা ও ম্যানেজমেন্ট সিস্টেম', defaultEnabled: true },
    { key: 'resources', label: 'Resource Library', description: 'ফাইল শেয়ারিং ও রিসোর্স লাইব্রেরি', defaultEnabled: true },
    { key: 'course_modules', label: 'Course Modules', description: 'কোর্স মডিউল ম্যানেজমেন্ট', defaultEnabled: true },
    { key: 'exam_results', label: 'পরীক্ষার ফলাফল', description: 'পরীক্ষার ফলাফল এন্ট্রি ও দেখার সিস্টেম', defaultEnabled: true },
    { key: 'cv_builder', label: 'CV Builder', description: 'ছাত্রদের CV তৈরির টুল', defaultEnabled: true },
    { key: 'policies', label: 'Policy & Minutes', description: 'Policy documents ও meeting minutes', defaultEnabled: true },
    { key: 'leave_tracking', label: 'Leave Tracking', description: 'শিক্ষকের ছুটি ম্যানেজমেন্ট', defaultEnabled: true },
    { key: 'chat', label: 'Chat System', description: 'ছাত্র-admin chat সিস্টেম', defaultEnabled: true },
    { key: 'deployments', label: 'Student Deployments', description: 'Mini-Netlify — ছাত্রদের সাইট হোস্টিং ফিচার', defaultEnabled: true },
    { key: 'typing_game', label: 'Typing Adventure', description: 'গেমিফাইড টাইপিং প্র্যাকটিস — কোর্স/মিশন/লিডারবোর্ড সহ', defaultEnabled: true },
    { key: 'typing_exam', label: 'Typing Test Exam', description: 'টাইপিং স্পিড/অ্যাকুরেসি এসেসমেন্ট এক্সাম — ব্যাচভিত্তিক ও পাবলিক লিংক', defaultEnabled: true },
    // ---- Sidebar-এর বাকি পেজ/ফিচার (আগে টগল ছিল না, এখন সুপার-এডমিন থেকে অন/অফ করা যাবে) ----
    { key: 'competitions', label: 'Competitions (Battle of Cups)', description: 'কম্পিটিশন ফর্ম তৈরি, গ্রুপ ও লিডারবোর্ড রিপোর্ট', defaultEnabled: true },
    { key: 'student_updates', label: 'Student Updates', description: 'ছাত্রদের জন্য নোটিশ/আপডেট পাঠানো', defaultEnabled: true },
    { key: 'feedback', label: 'Feedback', description: 'ছাত্রদের ফিডব্যাক দেখা ও ম্যানেজ করা', defaultEnabled: true },
    { key: 'teachers', label: 'Teacher Directory', description: 'শিক্ষক তালিকা ও ডিরেক্টরি', defaultEnabled: true },
    { key: 'schedule', label: 'Class Schedule', description: 'ক্লাস শিডিউল দেখা', defaultEnabled: true },
    { key: 'routine', label: 'Manage Routine', description: 'ক্লাস রুটিন ম্যানেজমেন্ট', defaultEnabled: true },
    { key: 'batch_info', label: 'All Batch Info', description: 'সব ব্যাচের তথ্য একসাথে', defaultEnabled: true },
    { key: 'batch_forms', label: 'Batch Forms', description: 'ব্যাচভিত্তিক ফর্ম ম্যানেজমেন্ট', defaultEnabled: true },
    { key: 'contact_messages', label: 'Contact Messages', description: 'যোগাযোগ ফর্মের মেসেজ ইনবক্স', defaultEnabled: true },
    { key: 'student_leaves', label: 'Student Leaves', description: 'ছাত্রদের ছুটির আবেদন দেখা ও ম্যানেজ করা', defaultEnabled: true },
];

export type FeatureKey = string;

/** Tenant settings JSON থেকে features বের করে।
 *  - Stored value (true/false) থাকলে সেটাই চূড়ান্ত।
 *  - না থাকলে FeatureDefinition.defaultEnabled ব্যবহার হয়।
 *  - defaultEnabled না থাকলে (ভবিষ্যতের নতুন ফিচার) → OFF। */
export function getTenantFeatures(settings: unknown): Record<string, boolean> {
    const featuresRaw = (settings as { features?: Record<string, boolean> } | null)?.features ?? {};
    const result: Record<string, boolean> = {};
    for (const f of ALL_FEATURES) {
        const stored = featuresRaw[f.key];
        if (typeof stored === 'boolean') {
            result[f.key] = stored;
        } else {
            result[f.key] = f.defaultEnabled ?? false;
        }
    }
    return result;
}

export function isFeatureEnabled(settings: unknown, featureKey: string): boolean {
    const features = getTenantFeatures(settings);
    if (featureKey in features) return features[featureKey];
    // ALL_FEATURES-এ নেই এমন অচেনা key (ভবিষ্যতের ফিচার) → ডিফল্ট OFF
    const raw = (settings as { features?: Record<string, boolean> } | null)?.features;
    return raw?.[featureKey] ?? false;
}
