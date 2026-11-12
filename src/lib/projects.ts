import { addDays, riyadhToday } from "./format";

export type PhaseLite = {
  status: string;
  due_date: string;
  start_date: string | null;
  title: string;
};

export function projectProgress(phases: PhaseLite[]) {
  const live = phases.filter((p) => p.status !== "ملغاة");
  if (!live.length) return 0;
  return Math.round((100 * live.filter((p) => p.status === "مكتملة").length) / live.length);
}

/** متأخر / معرّض للتأخر / على المسار — by the rules in the brief */
export function projectHealth(phases: PhaseLite[], today = riyadhToday()) {
  const open = phases.filter((p) => p.status !== "مكتملة" && p.status !== "ملغاة");
  if (open.some((p) => p.due_date < today)) return "متأخر";
  const soon = addWorkdaysJs(today, 3);
  if (open.some((p) => p.status === "لم تبدأ" && p.due_date <= soon)) return "معرّض للتأخر";
  return "على المسار";
}

export function nextPhase(phases: PhaseLite[]) {
  return phases
    .filter((p) => p.status !== "مكتملة" && p.status !== "ملغاة")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
}

export function addWorkdaysJs(d: string, n: number) {
  let r = d;
  let c = 0;
  while (c < n) {
    r = addDays(r, 1);
    const dow = new Date(r + "T12:00:00Z").getUTCDay();
    if (dow !== 5 && dow !== 6) c++;
  }
  return r;
}
