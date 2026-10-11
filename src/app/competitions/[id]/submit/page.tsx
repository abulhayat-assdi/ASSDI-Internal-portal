"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// The open form link is retired: reports are now filed from inside the student
// portal, where the roll and team come from the logged-in account.
export default function SubmitCompetitionMovedPage() {
  const { id } = useParams() as { id: string };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center text-slate-700 p-6 font-sans">
      <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center max-w-md shadow-md space-y-4">
        <div className="text-4xl">🏆</div>
        <p className="text-xl font-bold text-slate-800">এই ফর্মটি এখন স্টুডেন্ট পোর্টালে</p>
        <p className="text-sm text-slate-500">
          রিপোর্ট জমা দিতে আপনার স্টুডেন্ট পোর্টালে লগইন করুন, তারপর মেনু থেকে <strong>Competitions</strong>-এ যান।
        </p>
        <Link
          href={`/student-dashboard/competitions/${id}`}
          className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow transition"
        >
          Open in Student Portal
        </Link>
      </div>
    </div>
  );
}
