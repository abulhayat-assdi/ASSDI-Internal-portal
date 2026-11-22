/** Shared display formatting for typing-game pages. Pure, no I/O. */

/** Medium date + short time, rendered in UTC so server and client agree. */
export function formatDateTime(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}
