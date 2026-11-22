"use client";

import { usePathname } from "next/navigation";
import { baseForPath, type TypingBase } from "@/lib/typing-game/base";

/** Client side: the Typing Adventure base of the current page (student or teacher practice). */
export function useTypingBase(): TypingBase {
  return baseForPath(usePathname());
}
