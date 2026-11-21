"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Pages that should use the whole content area (lesson player). */
const FULL_WIDTH = /^\/student-dashboard\/typing-game\/lessons\/[^/]+$/;

/**
 * Page container for the typing area: a readable column for normal pages,
 * the full width of the content area for the lesson player.
 */
export function TypingContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const full = FULL_WIDTH.test(pathname);
  return (
    <div className={full ? "w-full px-2 pt-3 sm:px-4" : "mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6"}>{children}</div>
  );
}
