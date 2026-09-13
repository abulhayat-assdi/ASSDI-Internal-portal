"use client";

import { useState } from "react";
import { CourseData } from "@/data/modules/sales-mastery";

const THEMES = [
  { accent: "#D97706", wave1: "#22c55e", wave2: "#fbbf24" }, // 01 – Green + Gold
  { accent: "#16a34a", wave1: "#4ade80", wave2: "#15803d" }, // 02 – Green
  { accent: "#0891b2", wave1: "#22d3ee", wave2: "#0e7490" }, // 03 – Cyan
  { accent: "#1d4ed8", wave1: "#60a5fa", wave2: "#4338ca" }, // 04 – Blue
  { accent: "#7c3aed", wave1: "#c084fc", wave2: "#6d28d9" }, // 05 – Purple
];

const titleStyle = (color: string): React.CSSProperties => ({
  color,
  background: "none",
  backgroundImage: "none",
  WebkitBackgroundClip: "unset",
  backgroundClip: "unset",
  WebkitTextFillColor: color,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
  wordBreak: "break-word",
  margin: 0,
});

export default function CurriculumTimeline({ data }: { data: CourseData }) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });

  return (
    <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "40px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
      {data.modules.map((module, index) => {
        const isEven = index % 2 === 1;
        const t = THEMES[index % THEMES.length];
        const isOpen = openIndices.has(index);
        const num = String(module.moduleNumber).padStart(2, "0");

        return (
          <div key={module.moduleNumber}>

            {/* ─── CARD BUTTON ─── */}
            <button
              onClick={() => toggle(index)}
              style={{ width: "100%", display: "block", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              {/*
                Card uses position:relative + overflow:hidden.
                SVG draws the entire background (dark polygon + wave).
                Content sits on top with position:relative z-index:1.
              */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: 120,
                  borderRadius: 16,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
                  overflow: "hidden",
                  background: "#ffffff",
                  transition: "transform 0.25s ease, box-shadow 0.25s ease",
                }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLDivElement).style, { transform: "translateY(-3px)", boxShadow: "0 14px 40px rgba(0,0,0,0.14)" })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLDivElement).style, { transform: "translateY(0)", boxShadow: "0 4px 24px rgba(0,0,0,0.09)" })}
              >

                {/* ── SVG Background: dark polygon + S-curve wave ── */}
                <svg
                  aria-hidden="true"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                  viewBox="0 0 800 140"
                  preserveAspectRatio="none"
                >
                  {isEven ? (
                    <>
                      {/* Dark section LEFT with right-pointing arrow */}
                      <path d="M 0,0 L 192,0 L 230,70 L 192,140 L 0,140 Z" fill="#2b2d42" />
                      {/* Wave — back layer (wave2). S-curve on right edge */}
                      <path d="M 192,0 L 460,0 C 502,36 402,104 452,140 L 192,140 Z" fill={t.wave2} />
                      {/* Wave — front layer (wave1). Slightly narrower, creates depth */}
                      <path d="M 192,0 L 422,0 C 464,36 364,104 414,140 L 192,140 Z" fill={t.wave1} />
                    </>
                  ) : (
                    <>
                      {/* Dark section RIGHT with left-pointing arrow */}
                      <path d="M 608,0 L 800,0 L 800,140 L 608,140 L 570,70 Z" fill="#2b2d42" />
                      {/* Wave — back layer (wave2). S-curve on left edge */}
                      <path d="M 348,0 L 608,0 L 608,140 L 348,140 C 298,104 398,36 348,0 Z" fill={t.wave2} />
                      {/* Wave — front layer (wave1) */}
                      <path d="M 386,0 L 608,0 L 608,140 L 386,140 C 336,104 436,36 386,0 Z" fill={t.wave1} />
                    </>
                  )}
                </svg>

                {/* ── Content overlay ── */}
                <div style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  minHeight: 120,
                }}>
                  {isEven ? (
                    <>
                      {/* Topic number sits inside dark polygon (left ~29% of 800px) */}
                      <div style={{ width: "29%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: "16px 8px", flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 }}>Topic</span>
                        <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>{num}</span>
                      </div>
                      {/* Wave spacer (wave area ~32% of 800px) */}
                      <div style={{ width: "32%", flexShrink: 0 }} />
                      {/* Text — white area (remaining ~39%) */}
                      <CardText t={t} title={module.moduleTitle} isOpen={isOpen} titleStyle={titleStyle} />
                    </>
                  ) : (
                    <>
                      {/* Text — white area (left ~39%) */}
                      <CardText t={t} title={module.moduleTitle} isOpen={isOpen} titleStyle={titleStyle} />
                      {/* Wave spacer */}
                      <div style={{ width: "32%", flexShrink: 0 }} />
                      {/* Topic number — dark polygon (right ~29%) */}
                      <div style={{ width: "29%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: "16px 8px", flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 }}>Topic</span>
                        <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>{num}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* ─── ACCORDION ─── */}
            <div style={{
              overflow: "hidden",
              maxHeight: isOpen ? 6000 : 0,
              opacity: isOpen ? 1 : 0,
              marginTop: isOpen ? 12 : 0,
              transition: "max-height 0.5s ease-in-out, opacity 0.4s ease, margin-top 0.4s ease",
            }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #f1f5f9", padding: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>

                {/* Table header (desktop only) */}
                <div className="hidden md:grid grid-cols-12" style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", padding: "12px 16px", borderRadius: "8px 8px 0 0" }}>
                  <div className="col-span-5 text-center" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>Class Name</div>
                  <div className="col-span-7 text-center" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>Discussion Area</div>
                </div>

                {/* Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
                  {module.classes.map((cls, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12" style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
                      <div className="col-span-5" style={{ display: "flex", alignItems: "center", padding: "14px 12px", borderBottom: "1px solid #f1f5f9" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", lineHeight: 1.45, margin: 0, whiteSpace: "pre-line", textAlign: "left", width: "100%" }}>
                          {cls.className}
                        </p>
                      </div>
                      <div className="col-span-7" style={{ padding: "14px 16px" }}>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                          {cls.discussionArea.map((item, ii) => (
                            <li key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#475569", fontWeight: 500, lineHeight: 1.5 }}>
                              <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: t.accent, marginTop: 5, display: "inline-block" }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}

function CardText({ t, title, isOpen, titleStyle }: {
  t: typeof THEMES[0];
  title: string;
  isOpen: boolean;
  titleStyle: (c: string) => React.CSSProperties;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px 16px" }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 5px" }}>
        Course Module
      </p>
      <h2 style={{ ...titleStyle(t.accent), fontSize: "clamp(14px, 3.2vw, 21px)" }}>
        {title}
      </h2>
      <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
        {[1, 0.55, 0.25].map((op, i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, opacity: op, display: "inline-block" }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s", flexShrink: 0 }}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.04em" }}>
          {isOpen ? "বন্ধ করুন" : "পুরো মডিউল দেখতে ক্লিক করুন"}
        </span>
      </div>
    </div>
  );
}
