"use client";

import { useParams } from "next/navigation";
import QuizEditor from "@/components/quiz/builder/QuizEditor";

export default function EditQuizPage() {
    const params = useParams<{ id: string }>();
    return <QuizEditor quizId={params.id} />;
}
