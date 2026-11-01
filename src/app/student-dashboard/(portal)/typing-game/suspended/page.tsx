import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { SuspendedNotice } from "@/components/typing-game/suspended-notice";

/** Calm, informational landing for non-active accounts (message only, no data). */
export default function SuspendedPage({}: {}) {
  return <SuspendedNotice locale={DEFAULT_LOCALE} />;
}
