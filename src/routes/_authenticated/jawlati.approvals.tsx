import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { riyadhDate, useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { Empty, ListSkeleton, PageTitle, Panel, Pill } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/jawlati/approvals")({
  head: () => ({ meta: [{ title: "اعتماد الجولات | آمن" }] }),
  component: Approvals,
});

function Approvals() {
  const { data: me } = useMe();
  const name = useNames();
  const { n, date, month } = useFmt();
  const q = useQuery({
    enabled: !!me?.isStaff,
    queryKey: ["approvals"],
    queryFn: async () => {
      const [pending, recent] = await Promise.all([
        supabase
          .from("inspections")
          .select(
            "*, buildings!inspections_building_id_fkey(code, name), inspection_templates!inspections_template_id_fkey(name), inspection_answers!inspection_answers_inspection_id_fkey(result)",
          )
          .eq("status", "بانتظار الاعتماد")
          .order("submitted_at"),
        supabase
          .from("inspections")
          .select("*, buildings!inspections_building_id_fkey(code)")
          .in("status", ["معتمدة", "مرفوضة"])
          .order("reviewed_at", { ascending: false })
          .limit(10),
      ]);
      return { pending: pending.data ?? [], recent: recent.data ?? [] };
    },
  });
  if (me && !me.isStaff) return <Empty>هذه الصفحة لمديري الفرق.</Empty>;
  return (
    <div className="space-y-4">
      <PageTitle
        title="اعتماد الجولات"
        sub="راجع البنود غير المطابقة وصورها، ثم اعتمد الجولة أو أعدها للتعديل. عند الاعتماد تتحول كل ملاحظة إلى إجراء تصحيحي بموعد حسب خطورتها."
      />
      {q.isLoading ? (
        <ListSkeleton />
      ) : (q.data?.pending ?? []).length === 0 ? (
        <Empty>لا توجد جولات بانتظار الاعتماد.</Empty>
      ) : (
        <div className="space-y-2">
          {q.data!.pending.map((i) => {
            const bad = i.inspection_answers.filter((a) => a.result === "غير مطابق").length;
            const onTime = i.submitted_at && riyadhDate(i.submitted_at) <= i.due_date;
            return (
              <Link
                key={i.id}
                to="/jawlati/inspection/$id"
                params={{ id: i.id }}
                className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 hover:shadow-sm"
              >
                <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-national text-sm font-bold text-mint">
                  {i.buildings?.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {name(i.assignee_id)} · {month(i.due_date)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    أُرسلت {i.submitted_at ? date(riyadhDate(i.submitted_at)) : "—"} · الموعد{" "}
                    {date(i.due_date)}
                  </div>
                </div>
                <span className="text-sm tabular-nums">
                  امتثال {n(Number(i.compliance_percent ?? 0), 1)}٪
                </span>
                {bad > 0 && <Pill tone="overdue">{n(bad)} غير مطابق</Pill>}
                <Pill tone={onTime ? "مكتملة" : "soon"}>{onTime ? "في الموعد" : "متأخرة"}</Pill>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
      <Panel title="آخر ما راجعته الإدارة">
        {(q.data?.recent ?? []).length === 0 ? (
          <Empty>لا توجد مراجعات سابقة.</Empty>
        ) : (
          <div className="divide-y text-sm">
            {q.data!.recent.map((i) => (
              <Link
                key={i.id}
                to="/jawlati/inspection/$id"
                params={{ id: i.id }}
                className="flex items-center gap-3 py-2.5"
              >
                <b className="w-14 text-national">{i.buildings?.code}</b>
                <span className="flex-1">
                  {name(i.assignee_id)} · {month(i.due_date)}
                </span>
                <Pill tone={i.status} />
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
