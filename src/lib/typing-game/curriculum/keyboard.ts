/**
 * QWERTY layout and touch-typing finger map, shared by the lesson content
 * generator and the on-screen keyboard. Pure data, no I/O.
 */

export type Hand = "left" | "right";
export type FingerId =
  | "l-pinky"
  | "l-ring"
  | "l-middle"
  | "l-index"
  | "thumb"
  | "r-index"
  | "r-middle"
  | "r-ring"
  | "r-pinky";

export interface Finger {
  id: FingerId;
  hand: Hand | "both";
  en: string;
  bn: string;
  /** CSS colour for the finger zone. */
  color: string;
}

export const FINGERS: Record<FingerId, Finger> = {
  "l-pinky": { id: "l-pinky", hand: "left", en: "left little finger", bn: "বাম কনিষ্ঠা", color: "#f472b6" },
  "l-ring": { id: "l-ring", hand: "left", en: "left ring finger", bn: "বাম অনামিকা", color: "#a78bfa" },
  "l-middle": { id: "l-middle", hand: "left", en: "left middle finger", bn: "বাম মধ্যমা", color: "#60a5fa" },
  "l-index": { id: "l-index", hand: "left", en: "left index finger", bn: "বাম তর্জনী", color: "#34d399" },
  thumb: { id: "thumb", hand: "both", en: "thumb", bn: "বুড়ো আঙুল", color: "#fbbf24" },
  "r-index": { id: "r-index", hand: "right", en: "right index finger", bn: "ডান তর্জনী", color: "#2dd4bf" },
  "r-middle": { id: "r-middle", hand: "right", en: "right middle finger", bn: "ডান মধ্যমা", color: "#38bdf8" },
  "r-ring": { id: "r-ring", hand: "right", en: "right ring finger", bn: "ডান অনামিকা", color: "#c084fc" },
  "r-pinky": { id: "r-pinky", hand: "right", en: "right little finger", bn: "ডান কনিষ্ঠা", color: "#fb7185" },
};

export interface KeyCap {
  /** The character produced without Shift (lowercase); special keys use a name. */
  key: string;
  /** Character with Shift, when different. */
  shift?: string;
  /** Printed label. */
  label: string;
  /** Width in key units (1 = a letter key). */
  width: number;
  finger: FingerId;
  /** F and J carry the tactile bumps. */
  bump?: boolean;
}

const k = (key: string, finger: FingerId, shift?: string, extra: Partial<KeyCap> = {}): KeyCap => ({
  key,
  shift,
  label: shift && /[a-z]/.test(key) ? key.toUpperCase() : key,
  width: 1,
  finger,
  ...extra,
});
const special = (key: string, label: string, width: number, finger: FingerId): KeyCap => ({ key, label, width, finger });

export const KEYBOARD_ROWS: KeyCap[][] = [
  [
    k("`", "l-pinky", "~"), k("1", "l-pinky", "!"), k("2", "l-ring", "@"), k("3", "l-middle", "#"),
    k("4", "l-index", "$"), k("5", "l-index", "%"), k("6", "r-index", "^"), k("7", "r-index", "&"),
    k("8", "r-middle", "*"), k("9", "r-ring", "("), k("0", "r-pinky", ")"), k("-", "r-pinky", "_"),
    k("=", "r-pinky", "+"), special("Backspace", "delete", 2, "r-pinky"),
  ],
  [
    special("Tab", "tab", 1.5, "l-pinky"),
    k("q", "l-pinky", "Q"), k("w", "l-ring", "W"), k("e", "l-middle", "E"), k("r", "l-index", "R"),
    k("t", "l-index", "T"), k("y", "r-index", "Y"), k("u", "r-index", "U"), k("i", "r-middle", "I"),
    k("o", "r-ring", "O"), k("p", "r-pinky", "P"), k("[", "r-pinky", "{"), k("]", "r-pinky", "}"),
    k("\\", "r-pinky", "|", { width: 1.5 }),
  ],
  [
    special("CapsLock", "caps", 1.75, "l-pinky"),
    k("a", "l-pinky", "A"), k("s", "l-ring", "S"), k("d", "l-middle", "D"), k("f", "l-index", "F", { bump: true }),
    k("g", "l-index", "G"), k("h", "r-index", "H"), k("j", "r-index", "J", { bump: true }), k("k", "r-middle", "K"),
    k("l", "r-ring", "L"), k(";", "r-pinky", ":"), k("'", "r-pinky", '"'),
    special("Enter", "enter", 2.25, "r-pinky"),
  ],
  [
    special("ShiftLeft", "shift", 2.25, "l-pinky"),
    k("z", "l-pinky", "Z"), k("x", "l-ring", "X"), k("c", "l-middle", "C"), k("v", "l-index", "V"),
    k("b", "l-index", "B"), k("n", "r-index", "N"), k("m", "r-index", "M"), k(",", "r-middle", "<"),
    k(".", "r-ring", ">"), k("/", "r-pinky", "?"),
    special("ShiftRight", "shift", 2.75, "r-pinky"),
  ],
  [special(" ", "space", 6.25, "thumb")],
];

/** Home-row resting key for each finger. */
export const HOME_KEYS: Partial<Record<FingerId, string>> = {
  "l-pinky": "a",
  "l-ring": "s",
  "l-middle": "d",
  "l-index": "f",
  thumb: " ",
  "r-index": "j",
  "r-middle": "k",
  "r-ring": "l",
  "r-pinky": ";",
};

const BY_CHAR = new Map<string, { cap: KeyCap; shifted: boolean }>();
for (const row of KEYBOARD_ROWS) {
  for (const cap of row) {
    BY_CHAR.set(cap.key, { cap, shifted: false });
    if (cap.shift) BY_CHAR.set(cap.shift, { cap, shifted: true });
  }
}

/** Which key and finger type a character, and whether Shift is needed. */
export function keyFor(ch: string): { cap: KeyCap; shifted: boolean } | null {
  return BY_CHAR.get(ch) ?? null;
}

export function fingerFor(ch: string): Finger | null {
  const hit = keyFor(ch);
  return hit ? FINGERS[hit.cap.finger] : null;
}

/** Name of a key as shown in instructions ("Space", "F", ";"). */
export function keyDisplayName(ch: string): string {
  if (ch === " ") return "Space";
  return /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
}
