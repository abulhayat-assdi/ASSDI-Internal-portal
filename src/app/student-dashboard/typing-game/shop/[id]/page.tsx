import { notFound } from "next/navigation";
import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { PurchaseButton } from "@/components/typing-game/purchase-button";
import { previewUrl } from "@/components/typing-game/shop-card";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={item.name} description={item.description} />
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3">
            {preview ? (
              <img
                src={preview}
                alt={item.name}
                className="max-h-48 rounded object-contain"
              />
            ) : null}
            <p className="text-sm">
              {t("price")}: {item.priceCoins} {t("coins")}
            </p>
            {owned ? (
              <p className="text-sm">
                {t("owned")}
                {item.equipped ? ` · ${t("equipped")}` : ""}
              </p>
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
