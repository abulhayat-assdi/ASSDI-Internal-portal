"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Radio,
  Select,
} from "@/components/typing-game/ui";
import { passageStats } from "@/lib/typing-game/custom-missions";
import type {
  CompletionMode,
  LeaderboardMetric,
} from "@/lib/typing-game/server/custom-mission-store";

const STEPS = ["stepPassage", "stepRule", "stepReward", "stepBatches", "stepReview"] as const;

const LEADERBOARD_METRICS: LeaderboardMetric[] = [
  "fastest_time",
  "highest_accuracy",
  "highest_wpm",
  "most_repetitions",
];

export interface CustomMissionFormInitial {
  id?: string;
  title: string;
  description: string;
  passageText: string;
  completionMode: CompletionMode;
  timeLimitSeconds: number | null;
  repetitionsTarget: number | null;
  minAccuracy: number | null;
  minWpm: number | null;
  leaderboardMetric: LeaderboardMetric;
  rewardXp: number;
  rewardCoins: number;
  batchIds: string[];
}

/**
 * Multi-step draft wizard for teacher-authored custom missions. Creates
 * (POST) or edits a draft (PATCH) via the API — mirrors CompetitionForm's
 * fetch-based save pattern. Publish = save then immediately call activate.
 */
export function CustomMissionForm({
  locale,
  initial,
  batches,
}: {
  locale: Locale;
  initial: CustomMissionFormInitial;
  batches: { id: string; name: string }[];
}) {
  const t = getTranslator(locale, "missions");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [passageText, setPassageText] = useState(initial.passageText);
  const [completionMode, setCompletionMode] = useState<CompletionMode>(initial.completionMode);
  const [timeLimitStr, setTimeLimitStr] = useState(
    initial.timeLimitSeconds !== null ? String(initial.timeLimitSeconds) : "",
  );
  const [repsStr, setRepsStr] = useState(
    initial.repetitionsTarget !== null ? String(initial.repetitionsTarget) : "",
  );
  const [minAccuracyStr, setMinAccuracyStr] = useState(
    initial.minAccuracy !== null ? String(initial.minAccuracy) : "",
  );
  const [minWpmStr, setMinWpmStr] = useState(
    initial.minWpm !== null ? String(initial.minWpm) : "",
  );
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>(
    initial.leaderboardMetric,
  );
  const [rewardXp, setRewardXp] = useState(initial.rewardXp);
  const [rewardCoins, setRewardCoins] = useState(initial.rewardCoins);
  const [batchIds, setBatchIds] = useState<string[]>(initial.batchIds);

  const toggleBatch = (id: string) => {
    setBatchIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const timeLimitSeconds = timeLimitStr.trim() === "" ? null : Number(timeLimitStr);
  const repetitionsTarget = repsStr.trim() === "" ? null : Number(repsStr);
  const minAccuracy = minAccuracyStr.trim() === "" ? null : Number(minAccuracyStr);
  const minWpm = minWpmStr.trim() === "" ? null : Number(minWpmStr);
  const stats = passageStats(passageText);

  const validPassage = title.trim().length > 0 && passageText.trim().length > 0;
  const validRule =
    completionMode === "once" ||
    (completionMode === "timed" && timeLimitSeconds !== null && timeLimitSeconds > 0) ||
    (completionMode === "repetitions" && repetitionsTarget !== null && repetitionsTarget > 0);

  const current = STEPS[step] ?? "stepPassage";
  const canNext =
    (current === "stepPassage" && validPassage) ||
    (current === "stepRule" && validRule) ||
    !["stepPassage", "stepRule"].includes(current);

  function ruleSummary(): string {
    if (completionMode === "timed") {
      return t("ruleTimedSummary", { seconds: timeLimitSeconds ?? 0 });
    }
    if (completionMode === "repetitions") {
      return t("ruleRepsSummary", { count: repetitionsTarget ?? 0 });
    }
    return t("ruleOnceSummary");
  }

  async function save(publish: boolean): Promise<void> {
    setSaving(publish ? "publish" : "draft");
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim(),
      passageText: passageText.trim(),
      completionMode,
      timeLimitSeconds: completionMode === "timed" ? timeLimitSeconds : null,
      repetitionsTarget: completionMode === "repetitions" ? repetitionsTarget : null,
      minAccuracy,
      minWpm,
      leaderboardMetric,
      rewardXp,
      rewardCoins,
      batchIds,
    };
    try {
      const url = initial.id
        ? `/api/typing-game/teacher/custom-missions/${initial.id}`
        : `/api/typing-game/teacher/custom-missions`;
      const res = await fetch(url, {
        method: initial.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(t("actionFailed"));
        return;
      }
      let id = initial.id;
      if (!id) {
        const data = (await res.json()) as { id?: string };
        id = data.id;
      }
      if (publish && id) {
        const pub = await fetch(`/api/typing-game/teacher/custom-missions/${id}/activate`, {
          method: "POST",
        });
        if (!pub.ok) {
          setError(t("actionFailed"));
          return;
        }
      }
      router.push(`/dashboard/typing-game/teacher/missions/${id ?? ""}`);
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setSaving(null);
    }
  }

  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2" aria-label="steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={i === step ? "tap-badge tap-badge-primary" : "tap-badge tap-badge-neutral"}
          >
            {String(i + 1)}. {t(s)}
          </li>
        ))}
      </ol>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {current === "stepPassage" ? (
                <div className="flex flex-col gap-3">
                  <Input
                    label={t("fieldTitle")}
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); }}
                    maxLength={160}
                  />
                  <label className="tap-field">
                    <span className="tap-label">{t("fieldDescription")}</span>
                    <textarea
                      className="tap-input"
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); }}
                      rows={2}
                    />
                  </label>
                  <label className="tap-field">
                    <span className="tap-label">{t("fieldPassageText")}</span>
                    <textarea
                      className="tap-input"
                      value={passageText}
                      onChange={(e) => { setPassageText(e.target.value); }}
                      placeholder={t("passagePlaceholder")}
                      rows={10}
                      maxLength={20000}
                    />
                    <p className="tap-hint">
                      {t("passageWordCount", { words: stats.words, chars: stats.chars })}
                    </p>
                  </label>
                </div>
              ) : null}

              {current === "stepRule" ? (
                <div className="flex flex-col gap-3">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="tap-label">{t("fieldCompletionMode")}</legend>
                    <Radio
                      name="completionMode"
                      label={t("completionOnce")}
                      hint={t("completionOnceHint")}
                      checked={completionMode === "once"}
                      onChange={() => { setCompletionMode("once"); }}
                    />
                    <Radio
                      name="completionMode"
                      label={t("completionTimed")}
                      hint={t("completionTimedHint")}
                      checked={completionMode === "timed"}
                      onChange={() => { setCompletionMode("timed"); }}
                    />
                    <Radio
                      name="completionMode"
                      label={t("completionRepetitions")}
                      hint={t("completionRepetitionsHint")}
                      checked={completionMode === "repetitions"}
                      onChange={() => { setCompletionMode("repetitions"); }}
                    />
                  </fieldset>

                  {completionMode === "timed" ? (
                    <Input
                      type="number"
                      min={1}
                      label={t("fieldTimeLimitSeconds")}
                      value={timeLimitStr}
                      onChange={(e) => { setTimeLimitStr(e.target.value); }}
                    />
                  ) : null}
                  {completionMode === "repetitions" ? (
                    <Input
                      type="number"
                      min={1}
                      label={t("fieldRepetitionsTarget")}
                      value={repsStr}
                      onChange={(e) => { setRepsStr(e.target.value); }}
                    />
                  ) : null}

                  <Input
                    type="number"
                    min={0}
                    max={100}
                    label={t("fieldMinAccuracy")}
                    value={minAccuracyStr}
                    onChange={(e) => { setMinAccuracyStr(e.target.value); }}
                  />
                  <Input
                    type="number"
                    min={0}
                    label={t("fieldMinWpm")}
                    value={minWpmStr}
                    onChange={(e) => { setMinWpmStr(e.target.value); }}
                  />
                </div>
              ) : null}

              {current === "stepReward" ? (
                <div className="flex flex-col gap-3">
                  <Input
                    type="number"
                    min={0}
                    label={t("fieldWinnerXp")}
                    value={rewardXp}
                    onChange={(e) => { setRewardXp(Math.max(0, Number(e.target.value) || 0)); }}
                  />
                  <Input
                    type="number"
                    min={0}
                    label={t("fieldRewardCoins")}
                    value={rewardCoins}
                    onChange={(e) => { setRewardCoins(Math.max(0, Number(e.target.value) || 0)); }}
                  />
                  <Select
                    label={t("fieldLeaderboardMetric")}
                    value={leaderboardMetric}
                    onChange={(e) => {
                      setLeaderboardMetric(e.target.value as LeaderboardMetric);
                    }}
                  >
                    {LEADERBOARD_METRICS.map((m) => (
                      <option key={m} value={m}>
                        {t(
                          m === "fastest_time"
                            ? "metricFastestTime"
                            : m === "highest_accuracy"
                              ? "metricHighestAccuracy"
                              : m === "highest_wpm"
                                ? "metricHighestWpm"
                                : "metricMostRepetitions",
                        )}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {current === "stepBatches" ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="tap-label">{t("fieldBatches")}</legend>
                  {batches.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("noBatchesYet")}</p>
                  ) : (
                    batches.map((b) => (
                      <Checkbox
                        key={b.id}
                        label={b.name}
                        checked={batchIds.includes(b.id)}
                        onChange={() => { toggleBatch(b.id); }}
                      />
                    ))
                  )}
                </fieldset>
              ) : null}

              {current === "stepReview" ? (
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("fieldTitle")}:</dt>
                    <dd>{title || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("detailsPassage")}:</dt>
                    <dd>{t("passageWordCount", { words: stats.words, chars: stats.chars })}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("stepRule")}:</dt>
                    <dd>{ruleSummary()}</dd>
                  </div>
                  {minAccuracy !== null ? (
                    <div className="flex gap-2">
                      <dt className="font-bold">{t("fieldMinAccuracy")}:</dt>
                      <dd>{t("minAccuracySummary", { value: minAccuracy })}</dd>
                    </div>
                  ) : null}
                  {minWpm !== null ? (
                    <div className="flex gap-2">
                      <dt className="font-bold">{t("fieldMinWpm")}:</dt>
                      <dd>{t("minWpmSummary", { value: minWpm })}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("detailsReward")}:</dt>
                    <dd>{t("rewardSummary", { xp: rewardXp, coins: rewardCoins })}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("fieldLeaderboardMetric")}:</dt>
                    <dd>
                      {t(
                        leaderboardMetric === "fastest_time"
                          ? "metricFastestTime"
                          : leaderboardMetric === "highest_accuracy"
                            ? "metricHighestAccuracy"
                            : leaderboardMetric === "highest_wpm"
                              ? "metricHighestWpm"
                              : "metricMostRepetitions",
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-bold">{t("fieldBatches")}:</dt>
                    <dd>
                      {batchIds.length > 0
                        ? batchIds.map(batchName).join(", ")
                        : t("reviewNoneSelected")}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => { setStep(step - 1); }}>
            {t("back")}
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => { setStep(step + 1); }}>
            {t("next")}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              loading={saving === "draft"}
              disabled={saving !== null || !validPassage || !validRule}
              onClick={() => { void save(false); }}
            >
              {t("saveDraft")}
            </Button>
            <Button
              loading={saving === "publish"}
              disabled={saving !== null || !validPassage || !validRule}
              onClick={() => { void save(true); }}
            >
              {t("publish")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
