"use client";

import { useEffect, useState } from "react";
import CurriculumTimeline from "@/components/course-modules/CurriculumTimeline";
import BackButton from "@/components/ui/BackButton";
import type { CourseData, SubModule } from "@/data/modules/sales-mastery";

interface DBModule {
  slug: string;
  title: string;
  description: string;
  curriculum: unknown;
  isPublished: boolean;
}

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; data: CourseData };

/**
 * Renders a module's curriculum from the database (course_modules table) for
 * the signed-in user's course. The database is the single source of truth, so
 * whatever an admin saves is what students and teachers see.
 */
export default function ModuleOutlineView({
  slug,
  onlyPublished,
  fullHeightClass,
}: {
  slug: string;
  onlyPublished: boolean;
  fullHeightClass: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/course-modules", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((rows: DBModule[]) => {
        if (cancelled) return;
        const m = Array.isArray(rows) ? rows.find((r) => r.slug === slug) : undefined;
        if (!m || (onlyPublished && !m.isPublished)) {
          setState({ status: "not-found" });
          return;
        }
        const modules = (Array.isArray(m.curriculum) ? m.curriculum : []) as SubModule[];
        setState({ status: "ready", data: { title: m.title, description: m.description, modules } });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [slug, onlyPublished]);

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.data.title} | Course Module`;
  }, [state]);

  return (
    <div
      className={`bg-[#f1f3f5] ${fullHeightClass} rounded-2xl relative overflow-hidden border border-gray-200`}
      style={{
        backgroundImage:
          "linear-gradient(#e9ecef 1px, transparent 1px), linear-gradient(90deg, #e9ecef 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <BackButton />
      </div>

      {state.status === "loading" && (
        <div className="text-center py-24">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#059669]"></div>
          <p className="mt-4 text-[#6b7280] text-sm">Loading module...</p>
        </div>
      )}

      {(state.status === "not-found" || state.status === "error") && (
        <div className="text-center py-24 px-4">
          <h1 className="text-xl font-bold text-gray-700">
            {state.status === "not-found" ? "Module not found" : "Could not load this module"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {state.status === "not-found"
              ? "This module may have been renamed or is not published yet."
              : "Please check your connection and refresh the page."}
          </p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div className="w-full py-6 sm:py-10 px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
            <span className="inline-block py-1 px-3 rounded-full bg-white shadow-sm border border-gray-200 text-gray-500 text-xs font-bold tracking-widest uppercase mb-3">
              Course Curriculum Guide
            </span>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black mb-3 tracking-tight text-gray-800 drop-shadow-sm uppercase">
              {state.data.title}
            </h1>
            <p className="text-sm md:text-base text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
              {state.data.description}
            </p>
          </div>

          <div className="pb-12 px-2 md:px-6">
            <CurriculumTimeline data={state.data} />
          </div>
        </>
      )}
    </div>
  );
}
