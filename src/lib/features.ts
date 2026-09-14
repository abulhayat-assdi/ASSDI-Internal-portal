export interface FeatureDefinition {
    key: string;
    label: string;
    description: string;
}

export const ALL_FEATURES: FeatureDefinition[] = [
    { key: 'homework', label: 'হোমওয়ার্ক', description: 'হোমওয়ার্ক জমা ও ম্যানেজমেন্ট সিস্টেম' },
    { key: 'resources', label: 'Resource Library', description: 'ফাইল শেয়ারিং ও রিসোর্স লাইব্রেরি' },
    { key: 'course_modules', label: 'Course Modules', description: 'কোর্স মডিউল ম্যানেজমেন্ট' },
    { key: 'exam_results', label: 'পরীক্ষার ফলাফল', description: 'পরীক্ষার ফলাফল এন্ট্রি ও দেখার সিস্টেম' },
    { key: 'cv_builder', label: 'CV Builder', description: 'ছাত্রদের CV তৈরির টুল' },
    { key: 'daily_tracker', label: 'Daily Tracker', description: 'Daily attendance/progress tracker' },
    { key: 'policies', label: 'Policy & Minutes', description: 'Policy documents ও meeting minutes' },
    { key: 'leave_tracking', label: 'Leave Tracking', description: 'শিক্ষকের ছুটি ম্যানেজমেন্ট' },
    { key: 'chat', label: 'Chat System', description: 'ছাত্র-admin chat সিস্টেম' },
    { key: 'deployments', label: 'Student Deployments', description: 'Mini-Netlify — ছাত্রদের সাইট হোস্টিং ফিচার' },
    { key: 'typing_game', label: 'Typing Adventure', description: 'গেমিফাইড টাইপিং প্র্যাকটিস — কোর্স/মিশন/লিডারবোর্ড সহ' },
    { key: 'typing_exam', label: 'Typing Test Exam', description: 'টাইপিং স্পিড/অ্যাকুরেসি এসেসমেন্ট এক্সাম — ব্যাচভিত্তিক ও পাবলিক লিংক' },
];

export type FeatureKey = string;

/** Tenant settings JSON থেকে features বের করে। Default: সব feature চালু। */
export function getTenantFeatures(settings: unknown): Record<string, boolean> {
    const featuresRaw = (settings as { features?: Record<string, boolean> } | null)?.features ?? {};
    const result: Record<string, boolean> = {};
    for (const f of ALL_FEATURES) {
        result[f.key] = featuresRaw[f.key] !== false; // undefined বা true → চালু
    }
    return result;
}

export function isFeatureEnabled(settings: unknown, featureKey: string): boolean {
    return getTenantFeatures(settings)[featureKey] ?? true;
}
