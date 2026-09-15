import { notFound } from "next/navigation";
import { Badge, Card, CardContent, PageHeader, RewardCard } from "@/components/typing-game/ui";
import { isLocale, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { ShopAdminActions } from "@/components/typing-game/shop-admin-actions";
import { previewUrl } from "@/components/typing-game/shop-card";

/** Admin item management: activate/deactivate, preview, ownership. */
export default async function AdminShopManagePage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const locale = DEFAULT_LOCALE;
  const { store } = await shopPageContext(locale);
  const item = await store.getItem(params.id);
  if (!item) notFound();
  const preview = previewUrl(item.previewKey ?? item.assetKey);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={item.name}
        description={
          <>
            {item.slug}{" "}
            <Badge tone={item.isActive ? "success" : "neutral"}>
              {item.isActive ? "active" : "draft"}
            </Badge>
          </>
        }
      />
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3">
            {preview ? (
              <RewardCard
                title={item.name}
                art={
                  <img
                    src={preview}
                    alt={item.name}
                    className="h-full w-full object-contain"
                  />
                }
                amount={`${String(item.priceCoins)} coins`}
              />
            ) : null}
            <ShopAdminActions
              locale={locale}
              itemId={item.id}
              active={item.isActive}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
