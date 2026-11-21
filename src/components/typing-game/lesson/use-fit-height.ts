"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Height that makes an element end exactly at the bottom of the window:
 * window height minus the element's distance from the top of the page and
 * a small bottom gap. Re-measured on resize. Returns undefined until
 * measured (first render uses normal flow).
 */
export function useFitHeight<T extends HTMLElement>(bottomGap = 28, min = 420) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(min, Math.floor(window.innerHeight - top - bottomGap)));
    };
    measure();
    // Fonts/header can settle a moment later.
    const t = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [bottomGap, min]);

  return { ref, height };
}
