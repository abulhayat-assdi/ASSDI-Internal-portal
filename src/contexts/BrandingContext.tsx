"use client";

import { createContext, useContext } from "react";
import { PLATFORM_BRANDING, type CourseBranding } from "@/types/branding";

const BrandingContext = createContext<CourseBranding>(PLATFORM_BRANDING);

/**
 * Feeds the current course's name/logo to client components.
 *
 * The value is resolved on the server (see @/lib/branding) and passed in from
 * the layout, so the course name is already correct on first paint — no
 * flash of a wrong or placeholder course name.
 */
export function BrandingProvider({
    value,
    children,
}: {
    value: CourseBranding;
    children: React.ReactNode;
}) {
    return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): CourseBranding {
    return useContext(BrandingContext);
}

/** Course name for copy like "Comprehensive Portal for <course>". */
export function useCourseName(): string {
    return useContext(BrandingContext).name;
}
