import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, monthStart, riyadhToday, useFmt } from "@/lib/format";
import { Avatar, Empty, NativeSelect, Panel } from "@/components/kit";
import { cn } from "@/lib/utils";

type Row = {
  user_id: string;
  full_name: string;
  points: number;
  rounds_on_time: number;
  same_day: number;
  documented: number;
  actions_closed: number;
  rounds_total: number;
  rejections: number;
  eligible: boolean;
  rank: number | null;
};

const MEDAL = ["bg-arfaj text-national", "bg-water text-national", "bg-sun text-national"];

/**
 * «تكريم الشهر»: candidates for recognition, visible to team managers and admins only.
 * Ranked by approved points; anyone with a round sent back in that month is not eligible.
 */
export function RecognitionPanel({ teamId }: { teamId: string | null | undefined }) {
  const { n, month } = useFmt();
  const today = riyadhToday();
  const months = Array.from({ length: 6 }, (_, i) => addMonths(monthStart(today), -i));
  // early in a month, the month that just ended is the one to recognise
  const [m, setM] = useState(() => (Number(today.slice(8, 10)) <= 10 ? months[1]! : months[0]!));
  const q = useQuery({
    queryKey: ["recognition", m, teamId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recognition_candidates", {
        p_month: m,
        ...(teamId ? { p_team: teamId } : {}),
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = q.data ?? [];
  const top = rows.filter((r) => r.eligible && r.rank !== null && r.rank <= 3);
  const rest = rows.filter((r) => !top.includes(r));

  const parts = (r: Row) =>
    [
      [r.rounds_on_time, "جولة في موعدها"],
      [r.documented, "ملاحظة موثقة بصورة"],
      [r.actions_closed, "إجراء أُغلق في موعده"],
      [r.same_day, "تقرير في اليوم نفسه"],
    ].filter(([v]) => (v as number) > 0) as [number, string][];

  return (
    <Panel
      title="تكريم الشهر"
      action={
        <NativeSelect ariaLabel="الشهر" value={m} onChange={setM} className="w-40">
          {months.map((x) => (
            <option key={x} value={x}>
              {month(x)}
            </option>
          ))}
        </NativeSelect>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        يظهر لك وحدك. الترشيح بحسب النقاط المعتمدة في الشهر، ولا يُرشَّح من أُعيدت له جولة في الشهر
        نفسه. قرار التكريم وإعلانه للمدير.
      </p>
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-water/50" />
      ) : q.isError ? (
        <Empty>تعذّر تحميل المرشحين.</Empty>
      ) : !top.length ? (
        <Empty>لا توجد نقاط معتمدة في هذا الشهر بعد.</Empty>
      ) : (
        <ol className="grid gap-3 md:grid-cols-3">
          {top.map((r) => (
            <li key={r.user_id} className="flex flex-col gap-2 rounded-xl border bg-white p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-sm font-bold",
                    MEDAL[(r.rank ?? 1) - 1],
                  )}
                  aria-label={`الترتيب ${r.rank}`}
                >
                  {n(r.rank ?? 0)}
                </span>
                <Avatar name={r.full_name} />
                <span className="min-w-0 flex-1 truncate font-semibold text-national">
                  {r.full_name}
                </span>
                <span className="text-lg font-bold tabular-nums text-leaf">
                  {n(r.points)}
                  <span className="ms-1 text-[11px] font-medium text-muted-foreground">نقطة</span>
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5 text-[11px] text-national">
                {parts(r).map(([v, label]) => (
                  <li key={label} className="rounded-full bg-water/70 px-2 py-0.5">
                    {n(v)} {label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-national">بقية الفريق ({n(rest.length)})</summary>
          <ul className="mt-2 divide-y">
            {rest.map((r) => (
              <li key={r.user_id} className="flex items-center gap-2 py-2">
                <Avatar name={r.full_name} className="h-7 w-7" />
                <span className="flex-1 truncate">{r.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.rejections > 0
                    ? "أُعيدت له جولة هذا الشهر"
                    : r.points === 0
                      ? "لا نقاط معتمدة بعد"
                      : ""}
                </span>
                <span className="w-10 text-left tabular-nums">{n(r.points)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
