import { Search } from "lucide-react";
import { EmptyState, Input, PageHeader, SectionHeader, Select } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { shopPageContext } from "@/lib/typing-game/server/shop-pages";
import { ShopCard } from "@/components/typing-game/shop-card";

/** Guild Market: featured, categories, search. */
export default async function ShopPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ category?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  const { store } = await shopPageContext(locale);
  const [items, inventory] = await Promise.all([
    store.listItems(),
    store.getInventory(),
  ]);
  const owned = new Set(inventory.map((i) => i.itemId));
  const category = searchParams.category ?? "";
  const q = (searchParams.q ?? "").toLowerCase();
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const shown = items.filter(
    (i) =>
      (category === "" || i.category === category) &&
      (q === "" ||
        i.name.toLowerCase().includes(q) ||
        i.slug.includes(q)),
  );
  const featured = items.filter((i) => i.isFeatured);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("marketTitle")} description={t("marketSubtitle")} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Select name="category" defaultValue={category}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          name="q"
          placeholder={t("searchPlaceholder")}
          defaultValue={searchParams.q ?? ""}
        />
        <button
          type="submit"
          className="tap-btn tap-btn-secondary tap-btn-sm"
          aria-label={t("searchPlaceholder")}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
      {featured.length > 0 && category === "" && q === "" ? (
        <div className="flex flex-col gap-3">
          <SectionHeader title={t("featured")} />
          {featured.map((i) => (
            <ShopCard
              key={i.id}
              locale={locale}
              item={i}
              owned={owned.has(i.id)}
              href={`/student-dashboard/typing-game/shop/${i.id}`}
            />
          ))}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState title={t("marketTitle")} description={t("noItems")} />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((i) => (
            <ShopCard
              key={i.id}
              locale={locale}
              item={i}
              owned={owned.has(i.id)}
              href={`/student-dashboard/typing-game/shop/${i.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
