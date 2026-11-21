import { notFound } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/typing-game/i18n";
import { studentContext } from "@/lib/typing-game/server/student-pages";
import { userDbClient } from "@/lib/typing-game/server/auth";
import { createTestStore } from "@/lib/typing-game/server/test-store";
import { getStudentProfile } from "@/lib/typing-game/server/student";
import { findTest } from "@/lib/typing-game/tests/catalog";
import { PrintButton } from "@/components/typing-game/tests/print-button";

/** Printable certificate for one graded test (only the student's own — RLS). */
export default async function CertificatePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const { session, store } = await studentContext(DEFAULT_LOCALE);
  const client = await userDbClient();
  if (!client) throw new Error("SERVICE_UNAVAILABLE");
  const row = await createTestStore(client).get(sessionId);
  if (!row || row.status !== "graded" || row.wpm === null) notFound();
  const profile = await getStudentProfile(session.userId, store);
  const test = findTest(row.testId);
  const date = new Date(row.gradedAt ?? row.startedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const code = row.id.slice(0, 8).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden !important; }
          #tap-certificate, #tap-certificate * { visibility: visible !important; }
          #tap-certificate { position: fixed; inset: 0; margin: 0 auto; box-shadow: none !important; }
        }
      `}</style>
      <PrintButton />
      <article
        id="tap-certificate"
        className="relative w-full max-w-3xl bg-white p-10 text-center text-slate-800 shadow-xl sm:p-14"
        style={{ border: "10px double #1e3a5f", fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Certificate of Typing Proficiency</p>
        <h1 className="mt-4 text-4xl font-bold" style={{ color: "#1e3a5f" }}>
          {profile?.fullName ?? "Student"}
        </h1>
        {profile ? (
          <p className="mt-1 text-sm text-slate-500">
            {profile.batchName}
            {profile.rollNumber ? ` · Roll ${profile.rollNumber}` : ""}
          </p>
        ) : null}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed">
          has completed the <b>{test?.title ?? row.testId}</b> ({row.language === "bn" ? "Bangla" : "English"}) with the
          following result:
        </p>
        <div className="mt-6 flex items-end justify-center gap-12">
          <div>
            <p className="text-6xl font-bold tabular-nums" style={{ color: "#1e3a5f" }}>
              {Math.round(row.wpm)}
            </p>
            <p className="text-sm uppercase tracking-widest text-slate-500">words per minute</p>
          </div>
          <div>
            <p className="text-6xl font-bold tabular-nums" style={{ color: "#1e3a5f" }}>
              {Math.round(row.accuracy ?? 0)}%
            </p>
            <p className="text-sm uppercase tracking-widest text-slate-500">accuracy</p>
          </div>
        </div>
        <div className="mt-10 flex items-end justify-between text-left text-xs text-slate-500">
          <div>
            <p>Date: {date}</p>
            <p>Duration: {Math.round((row.timeMs ?? 0) / 1000)} seconds</p>
          </div>
          <div className="text-right">
            <p>Certificate ID</p>
            <p className="font-mono text-sm font-bold text-slate-700">{code}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
