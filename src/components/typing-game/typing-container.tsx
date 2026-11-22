"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Pages that should use the whole content area (lesson player). */
const FULL_WIDTH = /^\/student-dashboard\/typing-game\/lessons\/[^/]+$/;

/**
 * Page container for the typing area: every page uses the full width of
 * the content area (capped on very wide monitors); the lesson player also
 * drops the vertical padding so it can fill the window.
 */
export function TypingContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const full = FULL_WIDTH.test(pathname);
  return (
    <div className={full ? "w-full px-2 pt-3 sm:px-4" : "mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 xl:px-8"}>{children}</div>
  );
}
