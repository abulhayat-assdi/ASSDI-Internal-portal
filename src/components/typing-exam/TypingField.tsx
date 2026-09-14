"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { classifyLineChars, currentLineIndex, wrapIntoLines, type WrappedLine } from "@/lib/typing-exam/lineWrap";
import { GLASS_PANEL } from "@/components/typing-exam/ui";

export interface TypingFieldProps {
  examText: string;
  typedText: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MIN_CHARS_PER_LINE = 10;
const PROBE_CHAR_COUNT = 60;
const RESIZE_DEBOUNCE_MS = 120;

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
  const probeRef = useRef<HTMLSpanElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [charsPerLine, setCharsPerLine] = useState(50);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return;
    const charWidth = probe.getBoundingClientRect().width / PROBE_CHAR_COUNT;
    if (!charWidth) return;
    const next = Math.max(MIN_CHARS_PER_LINE, Math.floor(container.clientWidth / charWidth));
    setCharsPerLine(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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

  const visibleLines = useMemo(() => {
    const start = Math.max(0, curIndex - 1);
    const end = Math.min(lines.length, curIndex + 3); // 1 prev + current + up to 2 next
    return lines.slice(start, end).map((line, i) => ({ line, position: start + i }));
  }, [lines, curIndex]);

  const focusHiddenInput = () => hiddenInputRef.current?.focus();

  return (
    <div
      ref={containerRef}
      onClick={focusHiddenInput}
      className={`${GLASS_PANEL} relative cursor-text select-none overflow-hidden rounded-2xl p-6 font-mono`}
    >
      {/* Off-flow width probe used to derive a deterministic charsPerLine
          from the container's rendered width — monospace only, on purpose,
          so containerWidth / charWidth is exact. */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 whitespace-pre font-mono text-2xl"
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

      <div className="relative flex min-h-[9rem] flex-col items-center justify-center gap-2 py-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleLines.map(({ line, position }) => {
            const isCurrent = position === curIndex;
            return (
              <motion.div
                key={position}
                layout={!reduceMotion}
                initial={reduceMotion ? undefined : { opacity: 0, y: position < curIndex ? -14 : 14 }}
                animate={{ opacity: isCurrent ? 1 : 0.4, y: 0, scale: isCurrent ? 1 : 0.9 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -14 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.28, ease: "easeOut" }}
                className={`whitespace-pre text-center leading-relaxed ${isCurrent ? "text-2xl text-slate-800" : "text-lg text-slate-500"}`}
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
                className="absolute -left-px top-0 h-full w-[2px] rounded-full bg-brand-600"
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
              ? "rounded-[2px] bg-red-50 text-red-600"
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
