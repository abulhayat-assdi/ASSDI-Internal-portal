import { Badge, Card, CardContent, EmptyState, PageHeader, SectionHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { clanPageContext } from "@/lib/typing-game/server/clan-pages";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { ShopCard } from "@/components/typing-game/shop-card";
import { PurchaseButton } from "@/components/typing-game/purchase-button";
import { InventoryActions } from "@/components/typing-game/inventory-actions";

/** Clan Market: clan cosmetics for leaders, plus the clan vault. */
export default async function ClanShopPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  const { session, store: clanStore } = await clanPageContext(locale);
  const clan = await clanStore.getMyClan(session.userId);
  if (!clan) {
    return (
      <EmptyState title={t("clanShopTitle")} description={t("noItems")} />
    );
  }
  const { store } = await shopPageContext(locale);
  const [items, vault] = await Promise.all([
    store.listItems(),
    store.getClanInventory(clan.id),
  ]);
  const clanItems = items.filter((i) => i.itemType === "clan_cosmetic");
  const vaultIds = new Set(vault.map((v) => v.itemId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("clanShopTitle")}
        description={t("clanShopSubtitle")}
      />
      {clanItems.length === 0 ? (
        <EmptyState title={t("clanShopTitle")} description={t("noItems")} />
      ) : (
        <div className="flex flex-col gap-3">
          {clanItems.map((i) => (
            <div key={i.id} className="flex flex-col gap-2">
              <ShopCard
                locale={locale}
                item={i}
                owned={vaultIds.has(i.id)}
                href={`/student-dashboard/typing-game/shop/${i.id}`}
              />
              {!vaultIds.has(i.id) ? (
                <PurchaseButton
                  locale={locale}
                  itemId={i.id}
                  priceCoins={i.priceCoins}
                  clanId={clan.id}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
      <Card>
        <CardContent>
          <SectionHeader title={t("clanInventoryTitle")} />
          {vault.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("emptyInventory")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {vault.map((v) => (
                <div
                  key={v.itemId}
                  className={v.equipped ? "tap-owned-ring tap-equipped-ring flex flex-col gap-1 rounded-xl p-2" : "flex flex-col gap-1"}
                >
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {v.name}
                    {v.equipped ? (
                      <Badge tone="primary">
                        <span aria-hidden="true">✓</span>
                        {t("equipped")}
                      </Badge>
                    ) : null}
                  </p>
                  <InventoryActions
                    locale={locale}
                    itemId={v.itemId}
                    equipped={v.equipped}
                    equippable={v.equippable}
                    consumable={false}
                    quantity={v.quantity}
                    clanId={clan.id}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
