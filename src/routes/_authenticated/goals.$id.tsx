import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, FolderKanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { riyadhToday, useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { goalProgress, latestRag, ragTone } from "@/lib/goals";
import { RAG } from "@/lib/constants";
import {
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  PctRing,
  Pill,
} from "@/components/kit";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals/$id")({
  head: () => ({ meta: [{ title: "الهدف | آمن" }] }),
  component: GoalDetail,
});

function GoalDetail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const name = useNames();
  const { n, date } = useFmt();
  const [ci, setCi] = useState(false);
  const q = useQuery({
    queryKey: ["goal", id],
    queryFn: async () => {
      const [g, tasks, projects] = await Promise.all([
        supabase
          .from("annual_goals")
          .select(
            "*, goal_milestones!goal_milestones_goal_id_fkey(*), goal_checkins!goal_checkins_goal_id_fkey(*)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("tasks")
          .select("*, projects!tasks_project_id_fkey(title)")
          .eq("goal_id", id)
          .order("due_date"),
        supabase.from("projects").select("id, title, status, due_date").eq("goal_id", id),
      ]);
      if (g.error) throw g.error;
      return { goal: g.data, tasks: tasks.data ?? [], projects: projects.data ?? [] };
    },
  });
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["goal", id] });
    qc.invalidateQueries({ queryKey: ["goals"] });
  };
  const ms = useMutation({
    mutationFn: async ({
      mid,
      patch,
    }: {
      mid: string;
      patch: { title?: string; target_value?: number | null; status?: string };
    }) => {
      const { error } = await supabase.from("goal_milestones").update(patch).eq("id", mid);
      if (error) throw error;
    },
    onSuccess: inv,
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <ListSkeleton rows={4} />;
  const g = q.data?.goal;
  if (!g) return <Empty>لم نجد هذا الهدف.</Empty>;
  const canWrite =
    !!me && (g.owner_id === me.id || (me.isStaff && (me.isAdmin || me.teamId === g.team_id)));
  const pct = goalProgress(g, g.goal_checkins, g.goal_milestones);
  const rag = latestRag(g.goal_checkins);
  const checkins = [...g.goal_checkins].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-4">
      <Link to="/goals" className="inline-flex items-center gap-1 text-sm font-medium text-leaf">
        <ArrowRight className="h-4 w-4" /> الأهداف السنوية
      </Link>
      <PageTitle
        title={g.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {rag && <Pill tone={rag} />}
            {name(g.owner_id)} · {g.year} · الوزن {n(Number(g.weight))}٪
          </span>
        }
        action={
          canWrite && (
            <Button onClick={() => setCi(true)}>
              <Plus className="h-4 w-4" /> إضافة تحديث ربعي
            </Button>
          )
        }
      />
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Panel className="flex items-center justify-center">
          <PctRing pct={pct} size={120} label="التقدم" tone={rag ? ragTone[rag] : undefined} />
        </Panel>
        <Panel title="القياس">
          {g.description && <p className="mb-2 text-sm">{g.description}</p>}
          <p className="text-sm text-muted-foreground">
            {g.measure_type === "مراحل" ? (
              "التقدم = المستهدفات المتحققة ÷ كل المستهدفات."
            ) : (
              <>
                من {n(Number(g.baseline_value))} إلى {n(Number(g.target_value))} {g.unit}. آخر قيمة:{" "}
                <b className="text-ink">
                  {checkins[0]
                    ? `${n(Number(checkins[0].current_value))} ${g.unit ?? ""}`
                    : "لا يوجد تحديث بعد"}
                </b>
              </>
            )}
          </p>
        </Panel>
      </div>

      <Panel title="المستهدفات الربعية">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((qn) => (
            <div key={qn} className="space-y-2 rounded-xl bg-water/50 p-3">
              <div className="text-sm font-bold text-national">الربع {n(qn)}</div>
              {g.goal_milestones
                .filter((m) => m.quarter === qn)
                .map((m) => (
                  <div key={m.id} className="space-y-2 rounded-lg bg-white p-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <button
                        disabled={!canWrite}
                        onClick={() =>
                          ms.mutate({
                            mid: m.id,
                            patch: { status: m.status === "تحقق" ? "لم يتحقق" : "تحقق" },
                          })
                        }
                        aria-label="تبديل التحقق"
                        className="mt-0.5"
                      >
                        {m.status === "تحقق" ? (
                          <CheckCircle2 className="h-5 w-5 text-leaf" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      {canWrite ? (
                        <input
                          aria-label="عنوان المستهدف"
                          defaultValue={m.title}
                          onBlur={(e) =>
                            e.target.value !== m.title &&
                            ms.mutate({ mid: m.id, patch: { title: e.target.value } })
                          }
                          className="w-full rounded border-0 bg-transparent p-0 text-sm font-medium focus:ring-1 focus:ring-leaf"
                        />
                      ) : (
                        <span className="font-medium">{m.title}</span>
                      )}
                    </div>
                    {g.measure_type !== "مراحل" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        المستهدف
                        {canWrite ? (
                          <input
                            type="number"
                            aria-label="القيمة المستهدفة"
                            defaultValue={m.target_value ?? ""}
                            onBlur={(e) =>
                              ms.mutate({
                                mid: m.id,
                                patch: {
                                  target_value:
                                    e.target.value === "" ? null : Number(e.target.value),
                                },
                              })
                            }
                            className="h-8 w-20 rounded border px-2"
                          />
                        ) : (
                          <b>{m.target_value ?? "—"}</b>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">{date(m.due_date)}</div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="سجل التحديثات الربعية">
          {checkins.length === 0 ? (
            <Empty>لا توجد تحديثات بعد.</Empty>
          ) : (
            <ul className="space-y-2">
              {checkins.map((c) => (
                <li key={c.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>
                      الربع {n(c.quarter)} · {n(Number(c.current_value))} {g.unit}
                    </b>
                    <Pill tone={c.rag} />
                  </div>
                  {c.comment && <p className="mt-1 text-muted-foreground">{c.comment}</p>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {name(c.created_by)} · {date(c.created_at.slice(0, 10))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="العمل المرتبط بالهدف">
          <div className="space-y-2">
            {q.data!.projects.map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="flex items-center gap-2 rounded-xl border p-3 text-sm hover:bg-water/30"
              >
                <FolderKanban className="h-4 w-4 text-leaf" />{" "}
                <span className="flex-1 font-medium">{p.title}</span> <Pill tone={p.status} />
              </Link>
            ))}
            {q.data!.tasks.map((t) => (
              <TaskRow key={t.id} t={t} showOwner owner={name(t.owner_id)} />
            ))}
            {!q.data!.projects.length && !q.data!.tasks.length && (
              <Empty>اربط المهام والمشاريع بهذا الهدف من نموذج المهمة أو المشروع.</Empty>
            )}
          </div>
        </Panel>
      </div>
      {ci && (
        <CheckinDialog
          goalId={id}
          unit={g.unit}
          numeric={g.measure_type !== "مراحل"}
          open={ci}
          onOpenChange={setCi}
          onDone={inv}
        />
      )}
    </div>
  );
}

function CheckinDialog({
  goalId,
  unit,
  numeric,
  open,
  onOpenChange,
  onDone,
}: {
  goalId: string;
  unit: string | null;
  numeric: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const month = Number(riyadhToday().slice(5, 7));
  const [v, setV] = useState({
    quarter: String(Math.ceil(month / 3)),
    current_value: "",
    rag: "على المسار",
    comment: "",
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goal_checkins").insert({
        goal_id: goalId,
        quarter: Number(v.quarter),
        current_value: Number(v.current_value || 0),
        rag: v.rag,
        comment: v.comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُضيف التحديث");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const needComment = v.rag !== "على المسار" && !v.comment.trim();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تحديث ربعي"
      confirmLabel="حفظ"
      busy={add.isPending}
      confirmDisabled={needComment || (numeric && v.current_value === "")}
      onConfirm={() => add.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الربع">
          <NativeSelect value={v.quarter} onChange={(x) => setV({ ...v, quarter: x })}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                الربع {q}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {numeric && (
          <Field label={`القيمة الحالية ${unit ? `(${unit})` : ""}`}>
            <input
              type="number"
              className={inputCls}
              value={v.current_value}
              onChange={(e) => setV({ ...v, current_value: e.target.value })}
            />
          </Field>
        )}
        <Field label="الحالة" className="sm:col-span-2">
          <div className="flex gap-2">
            {RAG.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setV({ ...v, rag: r })}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border text-sm font-medium",
                  v.rag === r ? "border-national bg-national text-white" : "bg-white",
                )}
                aria-pressed={v.rag === r}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        <Field
          label={v.rag === "على المسار" ? "تعليق (اختياري)" : "تعليق (مطلوب)"}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={v.comment}
            onChange={(e) => setV({ ...v, comment: e.target.value })}
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
