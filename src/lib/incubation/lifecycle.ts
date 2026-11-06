import { todayDhaka } from "./domain";
export function incubationState(
  p: { status: string; startDate: string; endDate?: string | null },
  today = todayDhaka(),
) {
  if (p.status === "draft") return "draft";
  if (p.status === "archived") return "archived";
  if (["closed", "closing"].includes(p.status)) return p.status;
  if (p.startDate > today) return "scheduled";
  if (p.endDate && p.endDate < today) return "ended";
  return "running";
}
export function isIncubationRunning(p: Parameters<typeof incubationState>[0]) {
  return incubationState(p) === "running";
}
