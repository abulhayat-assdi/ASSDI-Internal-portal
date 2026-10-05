"use client";

import { useEffect, useState } from "react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import Leaderboard, { type LeaderboardRow } from "./Leaderboard";

interface BoardData {
  total: number;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
}

/** Batch leaderboard for a self-paced quiz; renders nothing when disabled or not yet released. */
export default function ResultLeaderboard({ quizId }: { quizId: string }) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/student/quiz/${quizId}/leaderboard`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) setBoard(body as BoardData);
        else if (body.error === "not-released") setNote("ফলাফল প্রকাশের পর লিডারবোর্ড দেখা যাবে।");
        // "disabled" / "not-found": show nothing.
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [quizId]);

  if (note) return <p className="text-center text-sm text-slate-400">{note}</p>;
  if (!board) return null;
  return (
    <div className={`${GLASS_PANEL} rounded-2xl p-4 sm:p-5`}>
      <Leaderboard rows={board.top} me={board.me} title={`ব্যাচ লিডারবোর্ড (${board.total} জন)`} />
    </div>
  );
}
