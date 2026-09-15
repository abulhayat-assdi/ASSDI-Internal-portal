import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/typing-game/ui";
import { getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";

/** Admin shop list (drafts included via RLS admin policy). */
export default async function AdminShopPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  const { store } = await shopPageContext(locale);
  const items = await store.listItems();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("manageTitle")}
        actions={
          <Link
            href="/dashboard/typing-game/admin/shop/new"
            className="tap-btn tap-btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t("createTitle")}</span>
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" aria-hidden="true" />}
          title={t("manageTitle")}
          description={t("noItems")}
          action={
            <Link
              href="/dashboard/typing-game/admin/shop/new"
              className="tap-btn tap-btn-primary"
            >
              {t("createTitle")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((i) => (
            <Link
              key={i.id}
              href={`/dashboard/typing-game/admin/shop/${i.id}`}
              className="tap-card tap-card-interactive flex flex-col gap-2 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="tap-card-title">{i.name}</h3>
                <Badge tone={i.isActive ? "success" : "neutral"}>
                  {i.isActive ? "active" : "draft"}
                </Badge>
              </div>
              <p className="text-xs text-ink-faint">{i.slug}</p>
              <p className="text-sm text-ink-muted">
                {t("price")}: {i.priceCoins} {t("coins")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
