/**
 * English Level 2 (Capitals & Punctuation) and Level 3 (Numbers & Symbols).
 * Each level starts from every key the previous levels taught.
 */
import { EN_FOUNDATION } from "./en-foundation";
import { buildLevel, levelKeys } from "./level-builder";

const RIGHT_HAND_CAPS = ["J", "K", "L", "H", "U", "I", "O", "P", "Y", "N", "M"];
const LEFT_HAND_CAPS = ["F", "D", "S", "A", "G", "R", "E", "W", "Q", "T", "V", "C", "X", "Z", "B"];

export const EN_CAPITALS = buildLevel(
  {
    id: "en-2",
    mode: "en",
    number: 2,
    title: "Capitals & Punctuation",
    description: "Shift দিয়ে বড় হাতের অক্ষর, তারপর ? ! : \" - / — বাক্য লেখার সব যতিচিহ্ন।",
    units: [
      {
        title: "Shift Keys",
        lessons: [
          { title: "Left Shift", kind: "keys", newKeys: RIGHT_HAND_CAPS },
          { title: "Right Shift", kind: "keys", newKeys: LEFT_HAND_CAPS },
          { title: "Capital Letters Review", kind: "review", newKeys: [] },
        ],
      },
      {
        title: "Punctuation",
        lessons: [
          { title: "Question Mark and Exclamation", kind: "keys", newKeys: ["?", "!"] },
          { title: "Colon and Quotation Marks", kind: "keys", newKeys: [":", '"'] },
          { title: "Hyphen and Slash", kind: "keys", newKeys: ["-", "/"] },
          { title: "Punctuation Review", kind: "review", newKeys: [] },
        ],
      },
      {
        title: "Wrapping Up",
        lessons: [
          { title: "Capitals & Punctuation Wrap-up", kind: "wrapup", newKeys: [] },
          { title: "Assessment 2", kind: "assessment", newKeys: [] },
        ],
      },
    ],
  },
  levelKeys(EN_FOUNDATION),
);

export const EN_NUMBERS = buildLevel(
  {
    id: "en-3",
    mode: "en",
    number: 3,
    title: "Numbers & Symbols",
    description: "উপরের সারির সংখ্যা আর @ # $ % & ( ) সহ সব চিহ্ন — দাম, তারিখ, ইমেইল, ফোন নম্বর।",
    units: [
      {
        title: "Number Row",
        lessons: [
          { title: "Numbers 1 to 5", kind: "keys", newKeys: ["1", "2", "3", "4", "5"] },
          { title: "Numbers 6 to 0", kind: "keys", newKeys: ["6", "7", "8", "9", "0"] },
          { title: "Numbers Review", kind: "review", newKeys: [] },
        ],
      },
      {
        title: "Symbols",
        lessons: [
          { title: "@ # $ and %", kind: "keys", newKeys: ["@", "#", "$", "%"] },
          { title: "& * ( and )", kind: "keys", newKeys: ["&", "*", "(", ")"] },
          { title: "_ + = and ^", kind: "keys", newKeys: ["_", "+", "=", "^"] },
          { title: "Brackets and Backslash", kind: "keys", newKeys: ["[", "]", "{", "}", "\\", "|"] },
          { title: "< > ~ and `", kind: "keys", newKeys: ["<", ">", "~", "`"] },
          { title: "Symbols Review", kind: "review", newKeys: [] },
        ],
      },
      {
        title: "Wrapping Up",
        lessons: [
          { title: "Numbers & Symbols Wrap-up", kind: "wrapup", newKeys: [] },
          { title: "Assessment 3", kind: "assessment", newKeys: [] },
        ],
      },
    ],
  },
  levelKeys(EN_CAPITALS),
);
