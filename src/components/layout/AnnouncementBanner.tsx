"use client";

import { useEffect, useState } from "react";
import { Megaphone, X, AlertTriangle, Info } from "lucide-react";

interface Announcement {
    title: string;
    body: string;
    level: "info" | "warning" | "urgent";
}

const LEVEL_STYLE: Record<Announcement["level"], string> = {
    info: "bg-blue-600",
    warning: "bg-amber-500",
    urgent: "bg-red-600",
};

/** Course-side banner for super-admin broadcasts. Dismissal is per-announcement (localStorage). */
export default function AnnouncementBanner() {
    const [ann, setAnn] = useState<(Announcement & { key: string }) | null>(null);

    useEffect(() => {
        fetch("/api/announcement")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.announcement) {
                    const key = `ann-dismissed-${d.updatedAt}-${d.announcement.title}`;
                    if (localStorage.getItem(key)) return;
                    setAnn({ ...d.announcement, key });
                }
            })
            .catch(() => { /* silent — banner is non-critical */ });
    }, []);

    if (!ann) return null;
    const Icon = ann.level === "info" ? Info : ann.level === "warning" ? AlertTriangle : Megaphone;

    return (
        <div className={`${LEVEL_STYLE[ann.level]} text-white text-sm`}>
            <div className="px-4 md:px-6 py-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                        <strong>{ann.title}</strong>
                        <span className="opacity-90"> — {ann.body}</span>
                    </span>
                </p>
                <button
                    onClick={() => { localStorage.setItem(ann.key, "1"); setAnn(null); }}
                    className="p-1 hover:bg-white/20 rounded shrink-0"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
