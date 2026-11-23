import Link from "next/link";
import { Card, CardContent, SectionHeader } from "@/components/typing-game/ui";
import { LEVELS } from "@/lib/typing-game/curriculum";
import { levelLessons } from "@/lib/typing-game/curriculum/progress";
import type { StudentProgressRow } from "@/lib/typing-game/server/batch-progress";

interface Member {
  userId: string;
  fullName: string;
  rollNumber: string;
}

interface Props {
  members: Member[];
  progress: Map<string, StudentProgressRow>;
  /** Level shown lesson-by-lesson (?level=…), or null for the summary only. */
  levelId: string | null;
  baseHref: string;
}

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(3 - Math.round(n));

/**
 * Teacher view: per-level completion for every student, and a lesson-by-
 * lesson grid for one chosen level (stars, Skipped, or not started).
 */
export function BatchLessonGrid({ members, progress, levelId, baseHref }: Props) {
  const level = LEVELS.find((l) => l.id === levelId) ?? null;
  const lessons = level ? levelLessons(level) : [];

  return (
    <Card>
      <CardContent>
        <SectionHeader title="Lesson progress" description="প্রতিটা লেভেলে কয়টা লেসন সম্পূর্ণ (গড় স্টার), সেরা ১ মিনিট টেস্ট, আর টাইপিং সময়।" />
        <div className="overflow-x-auto">
          <table className="tap-table text-sm">
            <thead>
              <tr>
                <th scope="col">Roll</th>
                <th scope="col">Name</th>
                {LEVELS.map((l) => (
                  <th key={l.id} scope="col" className="whitespace-nowrap text-center">
                    <Link href={`${baseHref}?level=${l.id}`} className="tap-link-btn" title={l.title}>
                      {l.mode === "bn" ? "BN " : "EN "}
                      {l.number}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="text-right">1-min best</th>
                <th scope="col" className="text-right">Today (min)</th>
                <th scope="col" className="text-right">7 days (min)</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const p = progress.get(m.userId);
                return (
                  <tr key={m.userId}>
                    <td>{m.rollNumber}</td>
                    <th scope="row" className="whitespace-nowrap">{m.fullName}</th>
                    {LEVELS.map((l) => {
                      const s = p?.perLevel[l.id];
                      const full = s && s.completed === s.total;
                      return (
                        <td key={l.id} className="whitespace-nowrap text-center tabular-nums" style={full ? { color: "var(--tap-success-500)", fontWeight: 700 } : undefined}>
                          {s && s.completed > 0 ? `${s.completed}/${s.total}` : "—"}
                          {s && s.completed > 0 ? <span className="ml-1 text-xs text-amber-500">{s.avgStars.toFixed(1)}★</span> : null}
                        </td>
                      );
                    })}
                    <td className="text-right tabular-nums">{p?.bestOneMinuteWpm != null ? Math.round(p.bestOneMinuteWpm) : "—"}</td>
                    <td className="text-right tabular-nums">{p?.todayMinutes ?? 0}</td>
                    <td className="text-right tabular-nums">{p?.weekMinutes ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {level ? (
          <div className="mt-6">
            <h3 className="mb-2 font-display text-base font-bold">
              {level.mode === "bn" ? "Bangla" : "English"} Level {level.number} · {level.title} — লেসন ধরে
            </h3>
            <div className="overflow-x-auto">
              <table className="tap-table text-xs">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    {lessons.map((l) => (
                      <th key={l.id} scope="col" className="text-center" title={l.title}>
                        {l.number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const p = progress.get(m.userId);
                    return (
                      <tr key={m.userId}>
                        <th scope="row" className="whitespace-nowrap">{m.fullName}</th>
                        {lessons.map((l) => {
                          const c = p?.perLesson[l.id];
                          return (
                            <td
                              key={l.id}
                              className="whitespace-nowrap text-center"
                              title={c ? `${l.title}: ${c.status}${c.status === "completed" ? `, ${Math.round(c.bestWpm)} wpm` : ""}` : `${l.title}: not started`}
                              style={
                                c?.status === "completed"
                                  ? { background: "rgba(16,185,129,0.12)", color: "#b45309" }
                                  : c?.status === "skipped"
                                    ? { background: "var(--tap-surface)", color: "var(--tap-ink-faint)" }
                                    : undefined
                              }
                            >
                              {c?.status === "completed" ? stars(c.stars) : c?.status === "skipped" ? "Skip" : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-faint">সবুজ = সম্পূর্ণ (স্টার) · Skip = অ্যাড দেখে বা Unlock করে এড়িয়ে যাওয়া · ফাঁকা = শুরু হয়নি</p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">লেসন-ধরে বিস্তারিত দেখতে উপরের যেকোনো লেভেলে ক্লিক করুন।</p>
        )}
      </CardContent>
    </Card>
  );
}
