import { Sparkles } from "lucide-react";
import { Badge, Card, CardContent, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { InventoryActions } from "@/components/typing-game/inventory-actions";
import { CATEGORY_ICON, previewUrl } from "@/components/typing-game/shop-card";

/** Personal inventory: owned, equipped, consumables, expired. */
export default async function InventoryPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  const { store } = await shopPageContext(locale);
  const items = await store.getInventory();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("inventoryTitle")}
        description={t("inventorySubtitle")}
      />
      {items.length === 0 ? (
        <EmptyState
          title={t("inventoryTitle")}
          description={t("emptyInventory")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((i) => {
            const preview = previewUrl(i.previewKey);
            const Icon = CATEGORY_ICON[i.category] ?? Sparkles;
            return (
              <Card
                key={i.itemId}
                className={i.equipped ? "tap-owned-ring tap-equipped-ring" : "tap-owned-ring"}
              >
                <CardContent>
                  <div className="flex items-center gap-3">
                    {preview ? (
                      <img
                        src={preview}
                        alt={i.name}
                        className="h-10 w-10 rounded"
                      />
                    ) : (
                      <span aria-hidden className="tap-shop-glyph" style={{ width: "2.5rem", height: "2.5rem" }}>
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                    )}
                    <div className="flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-base font-bold">
                        {i.name}
                        {i.equipped ? (
                          <Badge tone="primary">
                            <span aria-hidden="true">✓</span>
                            {t("equipped")}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-sm text-ink-muted">
                        ×{i.quantity}
                        {i.expiresAt ? ` · ${t("expired")}: ${i.expiresAt}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <InventoryActions
                      locale={locale}
                      itemId={i.itemId}
                      equipped={i.equipped}
                      equippable={i.equippable}
                      consumable={i.consumable}
                      quantity={i.quantity}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
