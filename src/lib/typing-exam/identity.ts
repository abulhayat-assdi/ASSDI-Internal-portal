/** Normalizes a phone number for duplicate-attempt matching (strips spaces, dashes, leading +/00). */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s-]/g, "").replace(/^\+?880/, "0").replace(/^00/, "");
}
