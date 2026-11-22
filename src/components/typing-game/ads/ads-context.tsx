"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AdSlotKey } from "@/lib/typing-game/ads/settings";

export type AllowedSlots = Partial<Record<AdSlotKey, { publisherId: string; slotId: string }>>;

const AdsContext = createContext<AllowedSlots>({});

/** Slots this student may see (computed on the server; empty while ads are off). */
export function AdsProvider({ slots, children }: { slots: AllowedSlots; children: ReactNode }) {
  return <AdsContext.Provider value={slots}>{children}</AdsContext.Provider>;
}

export function useAdSlot(key: AdSlotKey) {
  return useContext(AdsContext)[key] ?? null;
}
