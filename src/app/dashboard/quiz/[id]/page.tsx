"use client";

import { useParams } from "next/navigation";
import QuizResults from "@/components/quiz/results/QuizResults";

export default function QuizResultsPage() {
    const params = useParams<{ id: string }>();
    return <QuizResults quizId={params.id} />;
}
