/**
 * Pure grading logic for the quiz engine — no DB/Prisma imports here on
 * purpose, so it can be unit-tested directly (see grading.test.ts) and reused
 * identically wherever an attempt is scored.
 */

export type QuizQuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

export interface QuizOptionData {
    id: string;
    textHtml: string;
    isCorrect: boolean;
}

export interface GradableQuestion {
    id: string;
    type: QuizQuestionType;
    marks: number;
    options: QuizOptionData[];
}

export interface GradedAnswer {
    /** null = not auto-gradable yet (an answered SHORT_ANSWER awaiting manual grading). */
    isCorrect: boolean | null;
    marksAwarded: number;
}

/**
 * Grades one answer against its question.
 *
 * Rules (confirmed with the user, kept explicit since they're otherwise
 * ambiguous):
 *  - SINGLE_CHOICE / TRUE_FALSE: correct only if exactly the one correct
 *    option was selected.
 *  - MULTI_CHOICE: all-or-nothing — full marks only if the selected set
 *    exactly equals the correct set, else 0. No partial credit.
 *  - SHORT_ANSWER: never auto-graded; always returns isCorrect: null so the
 *    attempt is routed to the manual grading queue.
 *  - Negative marking (quiz.negativeMarkPerWrong) only applies to a question
 *    the student actually attempted (selected something) and got wrong —
 *    an unanswered question is never penalized.
 */
export function gradeAnswer(
    question: GradableQuestion,
    selectedOptionIds: string[],
    negativeMarkPerWrong: number
): GradedAnswer {
    if (question.type === "SHORT_ANSWER") {
        return { isCorrect: null, marksAwarded: 0 };
    }

    const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    const selectedIds = new Set(selectedOptionIds);
    const attempted = selectedIds.size > 0;

    let isCorrect: boolean;
    if (question.type === "MULTI_CHOICE") {
        isCorrect =
            attempted &&
            selectedIds.size === correctIds.size &&
            [...selectedIds].every((id) => correctIds.has(id));
    } else {
        isCorrect = attempted && selectedIds.size === 1 && correctIds.has([...selectedIds][0]);
    }

    let marksAwarded: number;
    if (isCorrect) {
        marksAwarded = question.marks;
    } else if (attempted && negativeMarkPerWrong > 0) {
        marksAwarded = -negativeMarkPerWrong;
    } else {
        marksAwarded = 0;
    }

    return { isCorrect, marksAwarded };
}

/** Strips answer keys before questions are sent to a student taking the quiz. */
export function stripCorrectness(
    options: QuizOptionData[]
): Array<Pick<QuizOptionData, "id" | "textHtml">> {
    return options.map(({ id, textHtml }) => ({ id, textHtml }));
}

export interface AttemptTotals {
    /** Raw sum of marksAwarded — can be negative with negative marking on. */
    score: number;
    totalMarks: number;
    /** Clamped to [0, 100]; based on max(0, score) so a negative raw score never reports negative %. */
    percentage: number;
    /** null until every SHORT_ANSWER answer in the attempt has been manually graded. */
    passed: boolean | null;
    hasUngraded: boolean;
}

/**
 * Rolls up an attempt's per-question grades into the attempt-level totals
 * stored on QuizAttempt (score/totalMarks/percentage/passed).
 */
export function computeAttemptTotals(
    questions: Pick<GradableQuestion, "id" | "marks">[],
    answersByQuestionId: Map<string, GradedAnswer>,
    passPercentage: number | null
): AttemptTotals {
    let score = 0;
    let totalMarks = 0;
    let hasUngraded = false;

    for (const q of questions) {
        totalMarks += q.marks;
        const answer = answersByQuestionId.get(q.id);
        if (!answer) continue; // unanswered — 0 marks, not "ungraded"
        if (answer.isCorrect === null) {
            hasUngraded = true;
            continue;
        }
        score += answer.marksAwarded;
    }

    const percentage = totalMarks > 0 ? (Math.max(0, score) / totalMarks) * 100 : 0;
    const passed = hasUngraded || passPercentage == null ? null : percentage >= passPercentage;

    return { score, totalMarks, percentage, passed, hasUngraded };
}
