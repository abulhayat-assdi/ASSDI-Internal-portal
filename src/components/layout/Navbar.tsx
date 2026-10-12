"use client";

import { getInitials } from "@/lib/utils";
import { useEffect, useState } from "react";
import Image from "next/image";
import { getImageUrl as libGetImageUrl } from "@/lib/getImageUrl";

import { useAuth } from "@/contexts/AuthContext";

// Hijri date conversion helper
function getHijriDate(date: Date): string {
    const hijriMonths = [
        "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
        "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Shaban",
        "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah"
    ];

    // Use Intl API for Hijri calendar conversion
    const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });

    const parts = hijriFormatter.formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value || '1';
    const month = parts.find(p => p.type === 'month')?.value || '1';
    const year = parts.find(p => p.type === 'year')?.value || '1447';

    const monthIndex = parseInt(month) - 1;
    const monthName = hijriMonths[monthIndex] || hijriMonths[0];

    return `${monthName} ${day}, ${year} AH`;
}

// English date & time formatter
function getEnglishDateTime(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) + ' · ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Helper to get direct image URL from Google Drive link
const getGoogleDriveThumbnailUrl = (url: string) => {
    if (url && url.includes("drive.google.com") && url.includes("/d/")) {
        const id = url.split("/d/")[1].split("/")[0];
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
    return url;
};

interface NavbarProps {
    /** "student": no floating hamburger to make room for (the bottom tab bar replaces it). */
    variant?: "student";
}

export default function Navbar({ variant }: NavbarProps = {}) {
    const [currentDateTime, setCurrentDateTime] = useState({ hijri: '', english: '' });
    const { userProfile, user } = useAuth();

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentDateTime({
                hijri: getHijriDate(now),
                english: getEnglishDateTime(now)
            });
        };

        // Set initial time
        updateDateTime();

        // Update every minute
        const interval = setInterval(updateDateTime, 60000);

        return () => clearInterval(interval);
    }, []);

    // Fallbacks if userProfile is still loading
    const displayName = userProfile?.displayName || user?.displayName || "User";
    const roleCapitalized = userProfile?.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : "Loading...";
    
    // Static fallback mapping for well-known instructors
    const TEACHER_IMAGE_MAPPING: Record<string, string> = {
        "Abul Hayat": "instructors/abul-hayat.jpg",
        "Golam Kibria": "instructors/golam-kibria.jpeg",
        "Shaibal Shariar": "instructors/shaibal-shariar.jpg",
    };

    // Resolve profile image from: Firestore -> Google Auth -> Static Mapping
    const rawProfileImage = userProfile?.profileImageUrl || user?.profileImageUrl || (displayName && TEACHER_IMAGE_MAPPING[displayName]);
    
    // Final image URL (handles local paths like instructors/abul-hayat.jpg and Google Drive)
    const profileImage = rawProfileImage ? libGetImageUrl(getGoogleDriveThumbnailUrl(rawProfileImage)) : null;

    return (
        <nav className="h-16 bg-white border-b border-[#e5e7eb] fixed top-0 left-0 lg:left-64 right-0 z-30">
            <div className="h-full px-4 md:px-6 flex items-center justify-between gap-3">
                {/* Page Title / Breadcrumb */}
                <div className={variant === "student" ? "min-w-0" : "ml-12 lg:ml-0"}>
                    <h2 className="text-lg md:text-xl font-semibold text-[#1f2937] whitespace-nowrap">
                        {variant === "student" || userProfile?.role === "student" ? "Student Portal" : "Internal Portal"}
                    </h2>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3 md:gap-6 shrink-0">
                    {/* Date & Time */}
                    <div className="hidden md:flex flex-col xl:flex-row items-end xl:items-center gap-0 xl:gap-3 bg-blue-50/80 border border-blue-200 px-3 xl:px-4 py-1 xl:py-1.5 rounded-xl shadow-sm backdrop-blur-sm leading-tight">
                        <span className="text-[#0284c7] font-bold text-xs xl:text-sm tracking-wide whitespace-nowrap">{currentDateTime.hijri}</span>
                        <div className="hidden xl:block w-px h-4 bg-blue-200"></div>
                        <span className="text-[#1e3a8a] font-bold text-xs xl:text-sm tracking-wide whitespace-nowrap">{currentDateTime.english}</span>
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block min-w-0">
                            <p className="text-sm font-medium text-[#1f2937] truncate max-w-[10rem] xl:max-w-[16rem]">
                                {displayName}
                            </p>
                            <p className="text-xs text-[#6b7280]">{roleCapitalized}</p>
                        </div>
                        <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#059669] to-[#10b981] flex items-center justify-center text-white font-bold text-sm overflow-hidden relative border border-gray-100">
                            {profileImage ? (
                                <Image
                                    src={profileImage}
                                    alt={displayName}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                />
                            ) : (
                                <span>{getInitials(displayName)}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
