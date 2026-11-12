import { daysBetween, riyadhDate, riyadhToday } from "./format";
import type { Task } from "./data";

/** Build an .xlsx in the browser (RTL sheet) and download it. */
export async function exportXlsx(
  fileName: string,
  sheet: string,
  rows: Record<string, string | number | null>[],
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${riyadhToday()}.xlsx`);
}

export function taskExportRows(
  tasks: Task[],
  name: (id?: string | null) => string,
  teams: { id: string; name: string }[],
) {
  const today = riyadhToday();
  return tasks.map((t) => {
    const done = t.completed_at ? riyadhDate(t.completed_at) : null;
    const late = done
      ? Math.max(0, daysBetween(t.due_date, done))
      : t.status !== "ملغاة"
        ? Math.max(0, daysBetween(t.due_date, today))
        : 0;
    return {
      الفريق: teams.find((x) => x.id === t.team_id)?.name ?? "",
      المسؤول: name(t.owner_id),
      المهمة: t.title,
      التصنيف: t.final_class ?? "",
      الحالة: t.status,
      "تاريخ الاستحقاق": t.due_date,
      "تاريخ الإنجاز": done ?? "",
      "أيام التأخر": late,
      "سبب التأخر": t.delay_reason
        ? t.delay_reason + (t.delay_note ? ` — ${t.delay_note}` : "")
        : "",
    };
  });
}
