"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { classifyLineChars, currentLineIndex, wrapIntoLines, type WrappedLine } from "@/lib/typing-exam/lineWrap";

export interface TypingFieldProps {
  examText: string;
  typedText: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MIN_CHARS_PER_LINE = 10;
const PROBE_CHAR_COUNT = 60;
const RESIZE_DEBOUNCE_MS = 120;
// Must exactly match the current-line text classes below — the probe is
// measured at runtime via getBoundingClientRect, so if these two class
// lists ever drift apart, charsPerLine goes back to being wrong (the same
// class of bug as before, just re-introduced by a font-size change instead
// of a padding one).
const CURRENT_LINE_TEXT_CLASS = "text-3xl md:text-4xl";
const OTHER_LINE_TEXT_CLASS = "text-xl md:text-2xl";

/**
 * Monkeytype-style single-line-focus typing renderer. Purely a controlled
 * VIEW over `typedText` (a plain, fully-recomputed string owned by the
 * parent, exactly as before) — this component never owns or diffs typing
 * state itself, so the index-exact, no-cascade scoring model in
 * scoring.ts stays intact. All character classification goes through
 * `classifyLineChars`/`currentLineIndex` from lineWrap.ts, which work in
 * the same absolute `examText` index space `scoreAttempt` uses.
 */
export default function TypingField({ examText, typedText, onChange, disabled }: TypingFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Measured against the INNER content wrapper (no horizontal padding of
  // its own), not the outer padded panel — clientWidth on the outer box
  // would include its p-6 padding, overestimating available text width by
  // ~48px (a handful of monospace characters) and causing lines to render
  // wider than the visible area, clipped by overflow-hidden.
  const innerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [charsPerLine, setCharsPerLine] = useState(50);

  const measure = useCallback(() => {
    const inner = innerRef.current;
    const probe = probeRef.current;
    if (!inner || !probe) return;
    const charWidth = probe.getBoundingClientRect().width / PROBE_CHAR_COUNT;
    if (!charWidth) return;
    const width = inner.clientWidth;
    if (!width) return; // transient 0-width mid-layout (e.g. fullscreen transition) — ResizeObserver will fire again once it settles
    const next = Math.max(MIN_CHARS_PER_LINE, Math.floor(width / charWidth));
    setCharsPerLine(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // ResizeObserver tracks the actual rendered box, so it recalculates for
  // ANY cause of a size change — window resize, sidebar toggle, and
  // crucially the fullscreen transition, which doesn't reliably fire a
  // plain `window resize` event at the right moment in every browser.
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timeout) clearTimeout(timeout);
    };
  }, [measure]);

  // Autofocus the hidden input whenever this field becomes interactive
  // (mirrors the old textarea's post-start focus() call).
  useEffect(() => {
    if (!disabled) hiddenInputRef.current?.focus();
  }, [disabled]);

  const lines = useMemo(() => wrapIntoLines(examText, charsPerLine), [examText, charsPerLine]);
  const curIndex = useMemo(() => currentLineIndex(lines, typedText.length), [lines, typedText.length]);

  // 4-line window, current line pinned at the 3rd visible slot (2 lines of
  // completed context above, 1 line of upcoming text below) once there's
  // enough typed history to fill it — matches a fixed reading position
  // instead of continuously re-centering, so the window only shifts (by
  // exactly one line) each time the line in that 3rd slot is finished.
  const visibleLines = useMemo(() => {
    const start = Math.max(0, curIndex - 2);
    const end = Math.min(lines.length, start + 4);
    return lines.slice(start, end).map((line, i) => ({ line, position: start + i }));
  }, [lines, curIndex]);

  const focusHiddenInput = () => hiddenInputRef.current?.focus();

  return (
    <div
      ref={containerRef}
      onClick={focusHiddenInput}
      className="relative cursor-text select-none overflow-hidden px-4 py-8 font-mono sm:px-8"
    >
      {/* Off-flow width probe used to derive a deterministic charsPerLine
          from the container's rendered width — monospace only, on purpose,
          so containerWidth / charWidth is exact. Font size must match
          CURRENT_LINE_TEXT_CLASS exactly (see note above). */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 whitespace-pre font-mono ${CURRENT_LINE_TEXT_CLASS}`}
        style={{ visibility: "hidden" }}
      >
        {"M".repeat(PROBE_CHAR_COUNT)}
      </span>

      {/* Visually-hidden-but-focusable input captures all keystrokes.
          Deliberately NOT display:none/visibility:hidden — those break
          focus/keyboard capture. */}
      <input
        ref={hiddenInputRef}
        value={typedText}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        aria-label="টাইপিং ইনপুট"
        tabIndex={disabled ? -1 : 0}
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div ref={innerRef} className="relative flex min-h-[16rem] w-full flex-col items-center justify-center gap-4 py-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleLines.map(({ line, position }) => {
            const isCurrent = position === curIndex;
            return (
              <motion.div
                key={position}
                layout={!reduceMotion}
                initial={reduceMotion ? undefined : { opacity: 0, y: position < curIndex ? -14 : 14 }}
                animate={{ opacity: isCurrent ? 1 : 0.35, y: 0, scale: isCurrent ? 1 : 0.9 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -14 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.28, ease: "easeOut" }}
                className={`whitespace-pre text-center leading-relaxed ${isCurrent ? `${CURRENT_LINE_TEXT_CLASS} text-slate-800` : `${OTHER_LINE_TEXT_CLASS} text-slate-400`}`}
              >
                {isCurrent ? (
                  <LineChars line={line} examText={examText} typedText={typedText} reduceMotion={!!reduceMotion} />
                ) : (
                  <span>{line.text}</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Renders the current line's characters with correctness + caret styling. */
function LineChars({
  line,
  examText,
  typedText,
  reduceMotion,
}: {
  line: WrappedLine;
  examText: string;
  typedText: string;
  reduceMotion: boolean;
}) {
  const states = classifyLineChars(line, examText, typedText);
  return (
    <>
      {line.text.split("").map((ch, j) => {
        const state = states[j];
        if (state === "caret") {
          return (
            <span key={j} className="relative inline-block">
              <motion.span
                aria-hidden="true"
                className="absolute -left-px top-0 h-full w-[3px] rounded-full bg-brand-600"
                animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                transition={reduceMotion ? undefined : { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
              />
              <span className="text-slate-300">{ch}</span>
            </span>
          );
        }
        const cls =
          state === "correct"
            ? "text-emerald-600"
            : state === "incorrect"
              ? "rounded-[3px] bg-yellow-300 text-slate-900"
              : "text-slate-300";
        return (
          <span key={j} className={cls}>
            {ch}
          </span>
        );
      })}
    </>
  );
}
