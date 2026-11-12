export type GoalLite = { measure_type: string; baseline_value: number; target_value: number };
export type Checkin = { current_value: number; created_at: string; rag: string; quarter: number };
export type Milestone = { status: string };

export function goalProgress(g: GoalLite, checkins: Checkin[], milestones: Milestone[]) {
  if (g.measure_type === "مراحل") {
    if (!milestones.length) return 0;
    return Math.round(
      (100 * milestones.filter((m) => m.status === "تحقق").length) / milestones.length,
    );
  }
  const last = [...checkins].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!last) return 0;
  const span = Number(g.target_value) - Number(g.baseline_value);
  if (span === 0) return 100;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((100 * (Number(last.current_value) - Number(g.baseline_value))) / span),
    ),
  );
}

export function latestRag(checkins: Checkin[]) {
  return [...checkins].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.rag ?? null;
}

export const ragTone: Record<string, string> = {
  "على المسار": "var(--leaf)",
  "معرّض للخطر": "#c9a400",
  متعثر: "var(--alert)",
};
