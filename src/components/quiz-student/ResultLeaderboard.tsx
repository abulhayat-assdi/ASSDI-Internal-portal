"use client";

import { useEffect, useState } from "react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";
import Leaderboard, { type LeaderboardRow } from "./Leaderboard";

interface BoardData {
  total: number;
  pending?: number;
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
  const pending = board.pending ?? 0;
  if (board.total === 0 && pending > 0) {
    return (
      <p className="text-center text-sm text-slate-500">
        লিডারবোর্ড এখনো তৈরি হয়নি — {pending} টি উত্তরপত্রের শর্ট-আনসার গ্রেডিংয়ের অপেক্ষায় আছে। গ্রেডিং শেষ হলে এখানে র‍্যাঙ্ক দেখা যাবে।
      </p>
    );
  }
  return (
    <div className={`${GLASS_PANEL} rounded-2xl p-4 sm:p-5`}>
      <Leaderboard rows={board.top} me={board.me} title={`ব্যাচ লিডারবোর্ড (${board.total} জন)`} />
      {pending > 0 && (
        <p className="mt-3 text-center text-xs text-slate-400">
          {pending} টি উত্তরপত্র গ্রেডিংয়ের অপেক্ষায় — র‍্যাঙ্কিং বদলে যেতে পারে।
        </p>
      )}
    </div>
  );
}
