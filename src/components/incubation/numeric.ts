/**
 * Number-only text input helpers. Used instead of <input type="number"> so
 * that letters can never be typed, pasted values like "1,200" or Bangla
 * digits are cleaned, and mobile shows the numeric keypad.
 */
const BN = "০১২৩৪৫৬৭৮৯";

/** Keeps digits and at most one decimal point; Bangla digits become ASCII. */
export function numericOnly(value: string, allowDecimal = true): string {
  const ascii = String(value ?? "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
  const cleaned = ascii.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (!allowDecimal) return cleaned;
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

/** Props to spread on an <input> so it only ever holds a number. */
export function numberInputProps(
  value: string | number | null | undefined,
  onValue: (v: string) => void,
  allowDecimal = true,
) {
  return {
    type: "text" as const,
    inputMode: (allowDecimal ? "decimal" : "numeric") as "decimal" | "numeric",
    value: value ?? "",
    onChange: (e: { target: { value: string } }) => onValue(numericOnly(e.target.value, allowDecimal)),
  };
}
