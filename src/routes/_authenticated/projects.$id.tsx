import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Link2, Target, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { daysBetween, riyadhToday, useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { projectHealth, projectProgress } from "@/lib/projects";
import {
  Avatar,
  ConfirmDialog,
  DueText,
  Empty,
  Field,
  ListSkeleton,
  PageTitle,
  Panel,
  PctRing,
  Pill,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "المشروع | آمن" }] }),
  component: ProjectDetail,
});

const barTone: Record<string, string> = {
  مكتملة: "bg-leaf",
  "قيد التنفيذ": "bg-teal",
  "لم تبدأ": "bg-blue/60",
  "بانتظار جهة خارجية": "bg-purple",
  ملغاة: "bg-ink/20",
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const name = useNames();
  const { date, n } = useFmt();
  const today = riyadhToday();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, annual_goals!projects_goal_id_fkey(id, title), project_phases!project_phases_project_id_fkey(*)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cancelM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "ملغاة", cancel_reason: reason.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُلغي المشروع");
      setCancel(false);
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <ListSkeleton rows={5} />;
  const p = q.data;
  if (!p) return <Empty>لم نجد هذا المشروع، أو ليست لديك صلاحية عرضه.</Empty>;
  const phases = [...p.project_phases].sort((a, b) => a.order_no - b.order_no);
  const progress = projectProgress(phases);
  const health = projectHealth(phases);
  const canManage =
    !!me && (p.owner_id === me.id || (me.isStaff && (me.isAdmin || me.teamId === p.team_id)));

  const starts = phases.map((x) => x.start_date ?? x.due_date);
  const minD = [p.start_date ?? starts[0], ...starts].filter(Boolean).sort()[0] as string;
  const maxD = [p.due_date, ...phases.map((x) => x.due_date)].sort().at(-1) as string;
  const span = Math.max(1, daysBetween(minD, maxD) + 1);
  const pos = (d: string) => (100 * daysBetween(minD, d)) / span;

  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-leaf">
        <ArrowRight className="h-4 w-4" /> المشاريع
      </Link>
      <PageTitle
        title={p.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={p.status === "ملغاة" ? "ملغاة" : health}>
              {p.status === "ملغاة" ? "ملغى" : health}
            </Pill>
            {name(p.owner_id)} · {date(p.start_date)} — {date(p.due_date)}
          </span>
        }
        action={
          canManage &&
          p.status !== "ملغاة" && (
            <Button variant="ghost" className="text-alert" onClick={() => setCancel(true)}>
              <XCircle className="h-4 w-4" /> إلغاء المشروع
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Panel className="flex items-center justify-center">
          <PctRing pct={progress} label="التقدم" size={120} />
        </Panel>
        <Panel title="عن المشروع">
          {p.description && <p className="text-sm">{p.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {p.annual_goals && (
              <Link
                to="/goals/$id"
                params={{ id: p.annual_goals.id }}
                className="inline-flex items-center gap-1 rounded-full bg-mint/70 px-3 py-1 font-medium text-national"
              >
                <Target className="h-4 w-4" /> {p.annual_goals.title}
              </Link>
            )}
            {p.source_task_id && (
              <Link
                to="/tasks/$id"
                params={{ id: p.source_task_id }}
                className="inline-flex items-center gap-1 rounded-full bg-water px-3 py-1 font-medium text-national"
              >
                <Link2 className="h-4 w-4" /> المهمة الأصلية
              </Link>
            )}
            {p.cancel_reason && (
              <span className="rounded-full bg-water px-3 py-1">
                سبب الإلغاء: {p.cancel_reason}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {n(phases.filter((x) => x.status === "مكتملة").length)} من {n(phases.length)} مراحل
            مكتملة. تُحدَّث المراحل من مهامها.
          </p>
        </Panel>
      </div>

      <Panel title="الجدول الزمني">
        {/* desktop: bars; mobile: list */}
        <div className="hidden space-y-2 md:block">
          <div className="relative h-5 text-[11px] text-muted-foreground">
            <span className="absolute start-0">{date(minD)}</span>
            <span className="absolute end-0">{date(maxD)}</span>
          </div>
          {phases.map((ph) => {
            const s = ph.start_date ?? ph.due_date;
            const late = ph.status !== "مكتملة" && ph.status !== "ملغاة" && ph.due_date < today;
            return (
              <div key={ph.id} className="grid grid-cols-[12rem_1fr] items-center gap-3">
                <span className="truncate text-sm font-medium">
                  {ph.order_no}. {ph.title}
                </span>
                <div className="relative h-7 rounded-md bg-water/50">
                  <div
                    className={cn(
                      "absolute inset-y-1 rounded",
                      barTone[ph.status] ?? "bg-teal",
                      late && "ring-2 ring-alert",
                    )}
                    style={{
                      insetInlineStart: `${pos(s)}%`,
                      width: `${Math.max(2, pos(ph.due_date) - pos(s) + 100 / span)}%`,
                    }}
                    title={`${date(s)} — ${date(ph.due_date)}`}
                  />
                  {today >= minD && today <= maxD && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-alert"
                      style={{ insetInlineStart: `${pos(today)}%` }}
                      aria-label="اليوم"
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
            {Object.entries(barTone)
              .slice(0, 4)
              .map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className={cn("h-2.5 w-4 rounded", v)} />
                  {k}
                </span>
              ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-0.5 bg-alert" />
              اليوم
            </span>
          </div>
        </div>
        <ol className="space-y-2 md:hidden">
          {phases.map((ph) => (
            <li key={ph.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1.5 h-3 w-3 shrink-0 rounded-full",
                  barTone[ph.status] ?? "bg-teal",
                )}
              />
              <div className="min-w-0 flex-1 text-sm">
                <b>{ph.title}</b>
                <div className="text-xs text-muted-foreground">
                  {date(ph.start_date)} — {date(ph.due_date)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="المراحل">
        <div className="space-y-2">
          {phases.map((ph) => {
            const dep = phases.find((x) => x.id === ph.depends_on_phase_id);
            const inner = (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3 hover:bg-water/30">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-national text-sm font-bold text-white tabular-nums">
                  {n(ph.order_no)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{ph.title}</div>
                  <div className="text-xs text-muted-foreground">
                    النتيجة: {ph.deliverable}
                    {dep ? ` · بعد «${dep.title}»` : ""}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs">
                  <Avatar name={name(ph.owner_id)} className="h-6 w-6 text-[10px]" />
                  {name(ph.owner_id)}
                </span>
                <DueText due={ph.due_date} done={ph.status === "مكتملة" || ph.status === "ملغاة"} />
                <Pill tone={ph.status} />
              </div>
            );
            return ph.task_id ? (
              <Link key={ph.id} to="/tasks/$id" params={{ id: ph.task_id }} className="block">
                {inner}
              </Link>
            ) : (
              <div key={ph.id}>{inner}</div>
            );
          })}
        </div>
      </Panel>

      <ConfirmDialog
        open={cancel}
        onOpenChange={setCancel}
        title="إلغاء المشروع"
        description="يبقى المشروع في السجل بحالة «ملغاة»."
        danger
        confirmLabel="إلغاء المشروع"
        confirmDisabled={!reason.trim()}
        busy={cancelM.isPending}
        onConfirm={() => cancelM.mutate()}
      >
        <Field label="سبب الإلغاء">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
