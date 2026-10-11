"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { classifyWord, cursorOf, passageWords, type LetterState } from "@/lib/typing-exam/words";

export interface TypingFieldProps {
  examText: string;
  typedText: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Lines visible at once. The line being typed is always the top one. */
const VISIBLE_LINES = 3;
/** Line height as a multiple of the font size (the viewport height derives from it). */
const LINE_HEIGHT_EM = 1.9;
/** How long the caret stays solid after a keystroke before it resumes blinking. */
const CARET_SOLID_MS = 550;

const BANGLA_RE = /[ঀ-৿]/;

const LETTER_CLASS: Record<LetterState, string> = {
  untyped: "text-slate-400",
  correct: "text-slate-800",
  wrong: "text-red-500",
  extra: "text-red-400",
};

interface WordProps {
  target: string;
  typed: string | undefined;
  /** True once the typist has moved past this word. */
  done: boolean;
}

/**
 * One passage word. Memoised on (target, typed, done), so a keystroke only
 * re-renders the word being typed (and the one just left) — the rest of
 * the passage is untouched, which is what keeps long passages smooth.
 */
const Word = memo(function Word({ target, typed, done }: WordProps) {
  const letters = classifyWord(target, typed);
  const wrong = done && typed !== target;
  return (
    <span
      className="inline-block"
      style={wrong ? { textDecoration: "underline", textDecorationColor: "#ef4444", textDecorationThickness: "2px", textUnderlineOffset: "0.18em" } : undefined}
    >
      {letters.map((l, i) => (
        <span key={i} className={LETTER_CLASS[l.state]}>
          {l.ch}
        </span>
      ))}
    </span>
  );
});

interface CaretPos {
  x: number;
  y: number;
  h: number;
  /** False when the caret jumps to a new line (no slide across the screen). */
  animate: boolean;
}

/**
 * Monkeytype-style typing view: every line is the same size, three lines
 * are visible, and the line being typed always sits at the top — when it
 * wraps, the text scrolls up smoothly by one line instead of the focus
 * jumping around. A single caret slides between characters.
 *
 * It is a controlled VIEW over `typedText` (owned by the engine through the
 * parent); it never owns typing state, so the scoring model is untouched.
 * Words wrap with the browser's own layout (no character-count guessing),
 * so it adapts to any width, zoom and font.
 */
export default function TypingField({ examText, typedText, onChange, disabled }: TypingFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [caret, setCaret] = useState<CaretPos | null>(null);
  const [typing, setTyping] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCaretY = useRef<number | null>(null);

  const words = useMemo(() => passageWords(examText), [examText]);
  const typedWords = useMemo(() => typedText.split(" "), [typedText]);
  const { wordIndex: curWord, pos: curPos } = useMemo(() => cursorOf(typedText), [typedText]);
  const useSans = useMemo(() => BANGLA_RE.test(examText), [examText]);

  // Position the caret on the character about to be typed and keep the
  // active line pinned at the top of the viewport.
  useLayoutEffect(() => {
    const container = wordsRef.current;
    if (!container) return;
    const wordEl = container.children[Math.min(curWord, container.children.length - 1)] as HTMLElement | undefined;
    if (!wordEl) return;
    const letters = wordEl.children;
    let x: number;
    let y: number;
    let h: number;
    // Offsets are relative to the (positioned) scroller, which is the
    // nearest offsetParent of the words and their letters alike.
    if (letters.length === 0) {
      x = wordEl.offsetLeft;
      y = wordEl.offsetTop;
      h = wordEl.offsetHeight;
    } else if (curPos < letters.length && curPos < (words[curWord]?.length ?? 0)) {
      const el = letters[curPos] as HTMLElement;
      x = el.offsetLeft;
      y = el.offsetTop;
      h = el.offsetHeight;
    } else {
      // Word typed to (or past) full length: caret sits after its last letter.
      const el = letters[letters.length - 1] as HTMLElement;
      x = el.offsetLeft + el.offsetWidth;
      y = el.offsetTop;
      h = el.offsetHeight;
    }
    const animate = prevCaretY.current === null || Math.abs(prevCaretY.current - y) < 1;
    prevCaretY.current = y;
    setCaret((c) => (c && c.x === x && c.y === y && c.h === h && c.animate === animate ? c : { x, y, h, animate }));
    const top = wordEl.offsetTop;
    setScrollY((s) => (s === top ? s : top));
  }, [curWord, curPos, typedText, words, layoutTick]);

  // Wrapping depends on the width: re-measure whenever the box resizes
  // (window resize, fullscreen, zoom, sidebar toggle).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayoutTick((t) => t + 1));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Fonts can finish loading after the first measurement.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready) return;
    let alive = true;
    document.fonts.ready.then(() => alive && setLayoutTick((t) => t + 1)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Keep the caret solid while typing; blink once idle.
  useEffect(() => {
    if (typedText.length === 0) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), CARET_SOLID_MS);
  }, [typedText]);
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    []
  );

  // Focus the hidden input whenever the field becomes interactive.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  // If focus wanders off (a click elsewhere), the next key press pulls it
  // back; moving focus inside keydown routes that same key to the input.
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const input = inputRef.current;
      if (input && document.activeElement !== input && !e.ctrlKey && !e.metaKey && !e.altKey) input.focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [disabled]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  // Typing only ever happens at the end of the text, as on Monkeytype.
  // Moving the caret, undo/redo, select-all and Tab/Enter (which would take
  // focus away or submit a form) are blocked.
  const keepCaretAtEnd = () => {
    const input = inputRef.current;
    if (!input) return;
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
  };
  const blockEditingKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const nav = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Delete", "Tab", "Enter"];
    const mod = e.ctrlKey || e.metaKey;
    if (nav.includes(e.key) || (mod && ["a", "z", "y"].includes(e.key.toLowerCase()))) e.preventDefault();
  };

  const showFocusHint = !disabled && !focused;
  const lineHeight = `${LINE_HEIGHT_EM}em`;

  return (
    <div
      ref={rootRef}
      onClick={focusInput}
      className="relative mx-auto w-full max-w-5xl cursor-text select-none px-1 sm:px-4"
    >
      {/* Visually-hidden-but-focusable input captures all keystrokes.
          Deliberately NOT display:none/visibility:hidden — those break
          focus/keyboard capture. */}
      <input
        ref={inputRef}
        value={typedText}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={blockEditingKeys}
        onSelect={keepCaretAtEnd}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        aria-label="টাইপিং ইনপুট"
        tabIndex={disabled ? -1 : 0}
        className="absolute left-0 top-0 h-0 w-0 overflow-hidden opacity-0"
      />

      <div
        className={`relative overflow-hidden ${useSans ? "" : "font-mono"} transition-[filter,opacity] duration-200 ${
          showFocusHint ? "opacity-40 blur-[3px]" : ""
        }`}
        style={{
          fontSize: "clamp(1.2rem, 0.9rem + 1.1vw, 1.9rem)",
          lineHeight,
          height: `calc(${VISIBLE_LINES} * ${lineHeight})`,
        }}
      >
        <div
          className="relative"
          style={{
            transform: `translate3d(0, ${-scrollY}px, 0)`,
            transition: "transform 160ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            willChange: "transform",
          }}
        >
          <div ref={wordsRef} className="whitespace-normal break-words">
            {words.map((w, i) => (
              <WordWithSpace key={i} target={w} typed={typedWords[i]} done={i < curWord} last={i === words.length - 1} />
            ))}
          </div>

          {caret && (
            <span
              aria-hidden="true"
              className={`exam-caret ${typing ? "exam-caret--solid" : ""}`}
              style={{
                transform: `translate3d(${caret.x}px, ${caret.y}px, 0)`,
                height: caret.h,
                transition: caret.animate ? "transform 90ms linear" : "none",
              }}
            />
          )}
        </div>
      </div>

      {showFocusHint && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            টাইপ করতে এখানে ক্লিক করুন অথবা যেকোনো কী চাপুন
          </span>
        </div>
      )}
    </div>
  );
}

/** A word followed by the space that separates it from the next one (the break point for wrapping). */
const WordWithSpace = memo(function WordWithSpace({ target, typed, done, last }: WordProps & { last: boolean }) {
  return (
    <>
      <Word target={target} typed={typed} done={done} />
      {last ? null : " "}
    </>
  );
});
