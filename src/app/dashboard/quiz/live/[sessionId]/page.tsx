"use client";

import { useParams } from "next/navigation";
import LiveHost from "@/components/quiz/live/LiveHost";

export default function QuizLiveHostPage() {
    const params = useParams<{ sessionId: string }>();
    return <LiveHost sessionId={params.sessionId} />;
}
