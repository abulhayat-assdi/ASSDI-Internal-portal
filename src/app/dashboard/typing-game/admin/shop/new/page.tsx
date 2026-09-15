import { Card, CardContent, PageHeader } from "@/components/typing-game/ui";
import { isLocale, getTranslator, DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { ShopForm } from "@/components/typing-game/shop-form";

/** Admin shop item creation (configuration form). */
export default function AdminShopNewPage({}: {}) {
  const locale = DEFAULT_LOCALE;
  const t = getTranslator(locale, "shop");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("createTitle")} />
      <Card>
        <CardContent>
          <ShopForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
