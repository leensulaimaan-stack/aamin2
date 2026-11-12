import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { nextPhase, projectHealth, projectProgress } from "@/lib/projects";
import { Bar, Empty, ListSkeleton, NativeSelect, PageTitle, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "المشاريع | آمن" }] }),
  component: Projects,
});

function Projects() {
  const { data: me } = useMe();
  const name = useNames();
  const { n, date } = useFmt();
  const [health, setHealth] = useState("");
  const [owner, setOwner] = useState("");
  const q = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, project_phases!project_phases_project_id_fkey(id, title, status, due_date, start_date, order_no)",
        )
        .neq("status", "ملغاة")
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });
  const rows = (q.data ?? []).map((p) => ({
    ...p,
    health: projectHealth(p.project_phases),
    progress: projectProgress(p.project_phases),
    next: nextPhase(p.project_phases),
  }));
  const owners = [...new Set(rows.map((r) => r.owner_id))];
  const shown = rows.filter(
    (r) => (!health || r.health === health) && (!owner || r.owner_id === owner),
  );

  return (
    <div>
      <PageTitle
        title="المشاريع"
        sub="المهام الطويلة مقسّمة إلى مراحل قصيرة لكل منها نتيجة وموعد"
        action={
          <Button asChild>
            <Link to="/projects/new" search={{}}>
              <Plus className="h-4 w-4" /> مشروع جديد
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:w-1/2">
        <NativeSelect ariaLabel="الحالة" value={health} onChange={setHealth}>
          <option value="">كل الحالات</option>
          <option>متأخر</option>
          <option>معرّض للتأخر</option>
          <option>على المسار</option>
        </NativeSelect>
        <NativeSelect ariaLabel="المسؤول" value={owner} onChange={setOwner}>
          <option value="">كل المسؤولين</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {name(o)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {q.isLoading ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <Empty
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/projects/new" search={{}}>
                أنشئ مشروعاً
              </Link>
            </Button>
          }
        >
          ستظهر هنا المشاريع. يمكنك أيضاً تحويل أي مهمة «طويلة» إلى مشروع من صفحتها.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="space-y-3 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-national">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {name(p.owner_id)} · حتى {date(p.due_date)}
                  </div>
                </div>
                <Pill tone={p.status === "مكتملة" ? "مكتملة" : p.health}>
                  {p.status === "مكتملة" ? "مكتمل" : p.health}
                </Pill>
              </div>
              <div className="flex items-center gap-3">
                <Bar pct={p.progress} />
                <span className="w-10 text-sm font-bold tabular-nums text-national">
                  {n(p.progress)}٪
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {p.next ? (
                  <>
                    المرحلة التالية: <b className="text-ink">{p.next.title}</b> ·{" "}
                    {date(p.next.due_date)}
                  </>
                ) : (
                  "اكتملت كل المراحل"
                )}
                {" · "}
                {n(p.project_phases.length)} مراحل
              </div>
            </Link>
          ))}
        </div>
      )}
      {me && !me.isStaff && (
        <p className="mt-4 text-xs text-muted-foreground">
          تظهر لك المشاريع التي تملكها أو تشارك في إحدى مراحلها.
        </p>
      )}
    </div>
  );
}
