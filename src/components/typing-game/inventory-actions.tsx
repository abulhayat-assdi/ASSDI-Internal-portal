"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";

/** Equip/unequip + consumable-use controls for one inventory entry. */
export function InventoryActions({
  locale,
  itemId,
  equipped,
  equippable,
  consumable,
  quantity,
  clanId,
}: {
  locale: Locale;
  itemId: string;
  equipped: boolean;
  equippable: boolean;
  consumable: boolean;
  quantity: number;
  clanId?: string;
}) {
  const t = getTranslator(locale, "shop");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function call(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      router.refresh();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function run(path: string, body: unknown): Promise<void> {
    const ok = await call(path, body);
    if (!ok) setFailed(true);
  }

  return (
    <div className="flex flex-col gap-1">
      {failed ? (
        <p role="alert" className="text-sm text-red-600">
          {t("actionFailed")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {equippable ? (
          <button
            type="button"
            className={`tap-btn tap-btn-sm ${equipped ? "tap-btn-secondary" : "tap-btn-primary"}`}
            disabled={busy}
            onClick={() => {
              void run(
                "/api/typing-game/inventory/equip",
                clanId
                  ? { itemId, equip: !equipped, clanId }
                  : { itemId, equip: !equipped },
              );
            }}
          >
            {equipped ? (
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {equipped ? t("unequip") : t("equip")}
          </button>
        ) : null}
        {consumable && !clanId ? (
          <button
            type="button"
            className="tap-btn tap-btn-secondary tap-btn-sm"
            disabled={busy || quantity === 0}
            onClick={() => {
              void run("/api/typing-game/inventory/use", { itemId });
            }}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("use")} ({quantity} {t("charges")})
          </button>
        ) : null}
      </div>
    </div>
  );
}
