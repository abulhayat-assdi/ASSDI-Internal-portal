import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Badge, Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { PurchaseButton } from "@/components/typing-game/purchase-button";
import { CATEGORY_ICON, CATEGORY_VISUAL, previewUrl } from "@/components/typing-game/shop-card";

/** Item detail: preview, price, ownership, purchase. */
export default async function ShopItemPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  const { store } = await shopPageContext(locale);
  const item = await store.getItem(params.id);
  if (!item) notFound();
  const preview = previewUrl(item.previewKey ?? item.assetKey);
  const owned = item.ownedQuantity > 0;
  const Icon = CATEGORY_ICON[item.category] ?? Sparkles;

  return (
    <div className="flex flex-col gap-6" data-visual={CATEGORY_VISUAL[item.category] ?? "vault"}>
      <PageHeader title={item.name} description={item.description} />
      <Card className={owned ? "tap-owned-ring" : undefined}>
        <CardContent>
          <div className="flex flex-col items-center gap-3 text-center">
            {preview ? (
              <img
                src={preview}
                alt={item.name}
                className="max-h-48 rounded object-contain"
              />
            ) : (
              <span aria-hidden className="tap-shop-glyph" style={{ width: "5rem", height: "5rem" }}>
                <Icon className="h-10 w-10 text-white" />
              </span>
            )}
            <p className="flex items-center gap-2 text-sm">
              {item.priceCoins} {t("coins")}
            </p>
            {owned ? (
              <Badge tone="success">
                <span aria-hidden="true">✓</span>
                {t("owned")}
                {item.equipped ? ` · ${t("equipped")}` : ""}
              </Badge>
            ) : (
              <PurchaseButton
                locale={locale}
                itemId={item.id}
                priceCoins={item.priceCoins}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
