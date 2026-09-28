import React from "react";

interface BrandLogoProps {
    size?: number;
    className?: string;
    primaryColor?: string;
    arrowColor?: string;
    logoUrl?: string | null;
}

export default function BrandLogo({
    size = 40,
    className = "",
    primaryColor = "#FFFFFF",
    arrowColor = "#4CAF50",
    logoUrl,
}: BrandLogoProps) {
    if (logoUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={logoUrl}
                alt="Brand Logo"
                className={className}
                // Uploaded logos are rarely square: fix the height, let the width follow.
                style={{ height: size, width: "auto", maxWidth: size * 4, objectFit: "contain", flexShrink: 0 }}
            />
        );
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Bar Chart - 3 bars */}
            <rect x="6" y="58" width="18" height="36" rx="2" fill={primaryColor} />
            <rect x="30" y="42" width="18" height="52" rx="2" fill={primaryColor} />
            <rect x="54" y="28" width="18" height="66" rx="2" fill={primaryColor} />

            {/* Upward Arrow */}
            <line x1="60" y1="65" x2="88" y2="22" stroke={arrowColor} strokeWidth="7" strokeLinecap="round" />
            <polyline points="72,18 88,22 83,37" fill="none" stroke={arrowColor} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

            {/* Graduation Cap */}
            <polygon points="50,4 82,18 50,32 18,18" fill={primaryColor} />
            <path d="M30 24 Q30 38 50 42 Q70 38 70 24" fill={primaryColor} />
            {/* Tassel */}
            <line x1="82" y1="18" x2="82" y2="32" stroke={arrowColor} strokeWidth="3" strokeLinecap="round" />
            <circle cx="82" cy="35" r="3.5" fill={arrowColor} />
        </svg>
    );
}
