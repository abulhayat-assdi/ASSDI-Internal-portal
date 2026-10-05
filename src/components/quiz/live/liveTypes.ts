import type { LabelStyle, QOption, QuizQuestionType } from "../types";

export type LiveStatus = "LOBBY" | "QUESTION" | "REVEAL" | "FINISHED";

export type LiveRank = { rank: number; name: string; roll: string; score: number };

export type LiveState = {
    id: string;
    quizId: string;
    quizTitle: string;
    joinCode: string;
    optionLabelStyle: LabelStyle;
    status: LiveStatus;
    remainingMs: number;
    limitSeconds: number;
    currentIndex: number;
    totalQuestions: number;
    question: { id: string; type: QuizQuestionType; bodyHtml: string; marks: number; options: QOption[]; explanationHtml: string } | null;
    answered: number;
    optionCounts: Record<string, number>;
    playerCount: number;
    players: { name: string; roll: string }[];
    leaderboard: LiveRank[];
};
