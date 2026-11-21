"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FINGERS, HOME_KEYS, type FingerId } from "@/lib/typing-game/curriculum/keyboard";
import { KEYBOARD_VIEWBOX, OnScreenKeyboard, keyCenters } from "./on-screen-keyboard";

const CENTERS = keyCenters();
const VB = `0 0 ${KEYBOARD_VIEWBOX.width} ${KEYBOARD_VIEWBOX.height}`;

/** Keyboard with an SVG overlay drawn in the same coordinates. */
function KeyboardWith({ next = "", children, zones = false }: { next?: string; children?: ReactNode; zones?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <OnScreenKeyboard next={next} showZones={zones} />
      <svg viewBox={VB} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

function Posture() {
  return (
    <svg viewBox="0 0 420 240" className="mx-auto w-full max-w-md" aria-hidden="true">
      <rect x="250" y="40" width="130" height="90" rx="8" fill="var(--tap-primary-100)" stroke="var(--tap-primary-500)" strokeWidth="3" />
      <rect x="305" y="130" width="20" height="40" fill="var(--tap-border-strong)" />
      <rect x="180" y="168" width="200" height="10" rx="4" fill="var(--tap-border-strong)" />
      <rect x="200" y="160" width="90" height="10" rx="3" fill="var(--tap-ink-muted)" />
      {/* person */}
      <circle cx="120" cy="62" r="22" fill="#fbbf24" />
      <line x1="120" y1="84" x2="120" y2="160" stroke="var(--tap-ink)" strokeWidth="10" strokeLinecap="round" />
      <path d="M120 105 L170 135 L215 160" fill="none" stroke="var(--tap-ink)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="d" values="M120 105 L170 135 L215 160;M120 105 L170 135 L220 158;M120 105 L170 135 L215 160" dur="1.6s" repeatCount="indefinite" />
      </path>
      <path d="M120 160 L180 160 L180 215" fill="none" stroke="var(--tap-ink)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="80" y="160" width="70" height="10" rx="4" fill="var(--tap-ink-muted)" />
      <line x1="90" y1="170" x2="90" y2="220" stroke="var(--tap-ink-muted)" strokeWidth="6" />
      {/* eye line */}
      <line x1="140" y1="58" x2="300" y2="80" stroke="var(--tap-success-500)" strokeWidth="2" strokeDasharray="6 5">
        <animate attributeName="stroke-dashoffset" values="0;-22" dur="1s" repeatCount="indefinite" />
      </line>
      <text x="152" y="128" fontSize="13" fill="var(--tap-success-500)" fontWeight="700">90°</text>
    </svg>
  );
}

function Bumps() {
  return (
    <KeyboardWith>
      {(["f", "j"] as const).map((k) => {
        const c = CENTERS.get(k)!;
        return (
          <circle key={k} cx={c.x} cy={c.y} r="18" fill="none" stroke="#f59e0b" strokeWidth="4">
            <animate attributeName="r" values="16;30;16" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
        );
      })}
    </KeyboardWith>
  );
}

function PlaceFingers() {
  const order: FingerId[] = ["l-index", "r-index", "l-middle", "r-middle", "l-ring", "r-ring", "l-pinky", "r-pinky", "thumb"];
  return (
    <KeyboardWith>
      {order.map((f, i) => {
        const key = HOME_KEYS[f]!;
        const c = CENTERS.get(key)!;
        const begin = `${i * 0.35}s`;
        return (
          <circle key={f} cx={c.x} cy={c.y} r="13" fill={FINGERS[f].color} stroke="#fff" strokeWidth="3" opacity="0">
            <animate attributeName="cy" from={c.y - 90} to={c.y} dur="0.45s" begin={begin} fill="freeze" />
            <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={begin} fill="freeze" />
          </circle>
        );
      })}
    </KeyboardWith>
  );
}

function ReturnHome() {
  const from = CENTERS.get("f")!;
  const to = CENTERS.get("r")!;
  const from2 = CENTERS.get("j")!;
  const to2 = CENTERS.get("m")!;
  return (
    <KeyboardWith>
      <circle r="14" fill={FINGERS["l-index"].color} stroke="#fff" strokeWidth="3">
        <animate attributeName="cx" values={`${from.x};${to.x};${from.x};${from.x}`} keyTimes="0;0.3;0.6;1" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${from.y};${to.y};${from.y};${from.y}`} keyTimes="0;0.3;0.6;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle r="14" fill={FINGERS["r-index"].color} stroke="#fff" strokeWidth="3">
        <animate attributeName="cx" values={`${from2.x};${from2.x};${to2.x};${from2.x}`} keyTimes="0;0.4;0.7;1" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${from2.y};${from2.y};${to2.y};${from2.y}`} keyTimes="0;0.4;0.7;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </KeyboardWith>
  );
}

function BadHabits() {
  const items = [
    { icon: "☝️", text: "এক আঙুলে টাইপ করা" },
    { icon: "👀", text: "বারবার কিবোর্ডের দিকে তাকানো" },
    { icon: "🙇", text: "কুঁজো হয়ে বসা" },
    { icon: "✊", text: "আঙুল হোম রো-তে না ফেরানো" },
  ];
  return (
    <ul className="mx-auto grid max-w-lg grid-cols-2 gap-3">
      {items.map((it) => (
        <li key={it.text} className="tap-card relative flex flex-col items-center gap-2 p-4 text-center text-sm">
          <span className="text-3xl" aria-hidden="true">{it.icon}</span>
          <span className="absolute right-3 top-2 text-xl font-black text-red-500" aria-hidden="true">✕</span>
          {it.text}
        </li>
      ))}
    </ul>
  );
}

const STEPS: { title: string; body: string; art: () => ReactNode }[] = [
  {
    title: "ঠিকভাবে বসুন",
    body: "পিঠ সোজা, কনুই প্রায় ৯০°, কব্জি হালকা উঁচু, আর স্ক্রিন চোখের সমান উচ্চতায়।",
    art: Posture,
  },
  {
    title: "F আর J খুঁজুন",
    body: "F আর J কী-তে ছোট উঁচু দাগ আছে। না তাকিয়েই আঙুল দিয়ে এই দাগ খুঁজে নিন।",
    art: Bumps,
  },
  {
    title: "আট আঙুল হোম রো-তে",
    body: "দুই তর্জনী F ও J-তে। বাকি আঙুল পাশাপাশি: বাম হাত A S D F, ডান হাত J K L ;। বুড়ো আঙুল Space-এ।",
    art: PlaceFingers,
  },
  {
    title: "প্রতিটা আঙুলের নিজের এলাকা",
    body: "একই রঙের কী-গুলো একই আঙুলের। নিজের রঙের বাইরে আঙুল যাবে না।",
    art: () => (
      <div className="flex flex-col gap-3">
        <KeyboardWith zones />
        <ul className="flex flex-wrap justify-center gap-2 text-xs">
          {(Object.keys(FINGERS) as FingerId[]).map((f) => (
            <li key={f} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: FINGERS[f].color }} />
              {FINGERS[f].bn}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    title: "চাপার পর হোম রো-তে ফিরুন",
    body: "কোনো কী চেপেই আঙুল আবার নিজের হোম কী-তে ফিরিয়ে আনুন। এতেই গতি আর নির্ভুলতা আসে।",
    art: ReturnHome,
  },
  {
    title: "Shift চাপবেন উল্টো হাতে",
    body: "বড় হাতের J লিখতে বাম কনিষ্ঠা দিয়ে বাম Shift চেপে ধরে ডান তর্জনী দিয়ে J চাপুন।",
    art: () => <KeyboardWith next="J" />,
  },
  {
    title: "এই অভ্যাসগুলো এড়িয়ে চলুন",
    body: "শুরুতে ধীরে হলেও সঠিক আঙুলে টাইপ করুন। গতি নিজে থেকেই বাড়বে।",
    art: BadHabits,
  },
];

/** Step-by-step animated guide to sitting and placing the hands. */
export function HandPlacementGuide({ onClose }: { onClose?: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const Art = step.art;
  return (
    <div className="tap-card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            How to place your hands · {i + 1}/{STEPS.length}
          </p>
          <h2 className="font-display text-xl font-bold">{step.title}</h2>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="tap-btn tap-btn-ghost tap-btn-sm" aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div key={i} className="tap-anim-in min-h-[200px]">
        <Art />
      </div>
      <p className="text-center text-sm text-ink-muted">{step.body}</p>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="tap-btn tap-btn-secondary tap-btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> আগের
        </button>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, d) => (
            <span key={d} className="h-2 w-2 rounded-full" style={{ background: d === i ? "var(--tap-primary-500)" : "var(--tap-border-strong)" }} />
          ))}
        </div>
        {i < STEPS.length - 1 ? (
          <button type="button" className="tap-btn tap-btn-primary tap-btn-sm" onClick={() => setI(i + 1)}>
            পরের <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="tap-btn tap-btn-primary tap-btn-sm" onClick={onClose}>
            শুরু করি
          </button>
        )}
      </div>
    </div>
  );
}
