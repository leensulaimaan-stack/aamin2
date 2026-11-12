import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { daysBetween, riyadhToday, useFmt } from "@/lib/format";
import { isOpen, useNames, useProfiles, useTeamTasks, useTeams, type Task } from "@/lib/data";
import { DECISIONS } from "@/lib/constants";
import { exportXlsx } from "@/lib/export";
import {
  ClassChip,
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  Pill,
  Segmented,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({ meta: [{ title: "قرارات الأسبوع | آمن" }] }),
  component: Decisions,
});

function Decisions() {
  const { data: me } = useMe();
  const teams = useTeams();
  const name = useNames();
  const { n, date } = useFmt();
  const today = riyadhToday();
  const [team, setTeam] = useState("");
  const [tab, setTab] = useState<"agenda" | "summary">("agenda");
  const [meeting, setMeeting] = useState(today);
  const [pick, setPick] = useState<Task | null>(null);
  const teamId = me?.isAdmin ? team || null : me?.teamId;
  const tasks = useTeamTasks(!!me?.isStaff, teamId);
  const decisions = useQuery({
    enabled: !!me?.isStaff,
    queryKey: ["decisions", meeting],
    queryFn: async () =>
      (
        await supabase
          .from("decisions")
          .select("*, tasks!decisions_task_id_fkey(title, team_id)")
          .eq("meeting_date", meeting)
          .order("decided_at")
      ).data ?? [],
  });
  const agenda = (tasks.data ?? []).filter(
    (t) =>
      isOpen(t.status) &&
      !t.inspection_id &&
      (t.final_class === "عالقة" || daysBetween(t.due_date, today) > 14),
  );

  if (me && !me.isStaff) return <Empty>هذه الصفحة لمديري الفرق.</Empty>;
  const summary = (decisions.data ?? []).filter((d) => !teamId || d.tasks?.team_id === teamId);

  return (
    <div className="space-y-4">
      <PageTitle
        title="قرارات الأسبوع"
        sub="المهام العالقة والمتأخرة أكثر من 14 يوماً. لكل مهمة قرار واحد: تنفيذ بموعد جديد، أو إسناد لموظف آخر، أو إلغاء."
        action={
          <>
            {me?.isAdmin && (
              <NativeSelect ariaLabel="الفريق" value={team} onChange={setTeam} className="w-40">
                <option value="">كل الفريقين</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <label className="flex items-center gap-2 text-sm">
              تاريخ الاجتماع{" "}
              <input
                type="date"
                value={meeting}
                onChange={(e) => setMeeting(e.target.value)}
                className={inputCls + " w-40"}
              />
            </label>
          </>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "agenda", label: "جدول الأعمال", count: agenda.length },
          { value: "summary", label: "ملخص الاجتماع", count: summary.length },
        ]}
      />
      {tab === "agenda" &&
        (tasks.isLoading ? (
          <ListSkeleton />
        ) : agenda.length === 0 ? (
          <Empty>لا توجد مهام عالقة أو متأخرة أكثر من أسبوعين.</Empty>
        ) : (
          <div className="space-y-2">
            {agenda.map((t) => {
              const late = daysBetween(t.due_date, today);
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/tasks/$id"
                      params={{ id: t.id }}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ClassChip cls={t.final_class} />
                      {name(t.owner_id)} · الموعد {date(t.due_date)}
                      {late > 0 && <Pill tone="overdue">متأخرة {n(late)} يوماً</Pill>}
                      {t.final_class === "عالقة" && (
                        <span>
                          لم تبدأ منذ {n(daysBetween(t.created_at.slice(0, 10), today))} يوماً
                        </span>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => setPick(t)}>تسجيل القرار</Button>
                </div>
              );
            })}
          </div>
        ))}
      {tab === "summary" && (
        <Panel
          title={`ملخص قرارات اجتماع ${date(meeting)}`}
          action={
            summary.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportXlsx(
                    `قرارات-${meeting}`,
                    "القرارات",
                    summary.map((d) => ({
                      المهمة: d.tasks?.title ?? "",
                      القرار: d.decision,
                      "الموعد الجديد": d.new_due_date ?? "",
                      "المسؤول الجديد": d.new_owner_id ? name(d.new_owner_id) : "",
                      السبب: d.reason ?? "",
                      اتخذه: name(d.decided_by),
                    })),
                  )
                }
              >
                <Download className="h-4 w-4" /> تصدير Excel
              </Button>
            )
          }
        >
          {summary.length === 0 ? (
            <Empty>لم تُسجّل قرارات في هذا التاريخ.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {summary.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <Link
                    to="/tasks/$id"
                    params={{ id: d.task_id }}
                    className="min-w-0 flex-1 font-medium hover:underline"
                  >
                    {d.tasks?.title}
                  </Link>
                  <Pill
                    tone={
                      d.decision === "إلغاء"
                        ? "ملغاة"
                        : d.decision === "إسناد لموظف آخر"
                          ? "later"
                          : "قيد التنفيذ"
                    }
                  >
                    {d.decision}
                  </Pill>
                  <span className="text-xs text-muted-foreground">
                    {d.new_due_date && `موعد جديد ${date(d.new_due_date)}`}
                    {d.new_owner_id && ` · إلى ${name(d.new_owner_id)}`}
                    {d.reason && ` · ${d.reason}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {pick && <DecisionDialog task={pick} meeting={meeting} onClose={() => setPick(null)} />}
    </div>
  );
}

function DecisionDialog({
  task,
  meeting,
  onClose,
}: {
  task: Task;
  meeting: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const profiles = useProfiles();
  const today = riyadhToday();
  const [d, setD] = useState<string>(DECISIONS[0]);
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("apply_decision", {
        p_task: task.id,
        p_decision: d,
        p_new_due: (due || null) as string,
        p_new_owner: (owner || null) as string,
        p_reason: (reason.trim() || null) as string,
        p_meeting: meeting,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("سُجّل القرار وطُبّق على المهمة");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["decisions"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const valid =
    d === "تنفيذ بموعد جديد" ? !!due : d === "إسناد لموظف آخر" ? !!owner : !!reason.trim();
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="قرار بشأن المهمة"
      description={task.title}
      confirmLabel="تسجيل القرار"
      danger={d === "إلغاء"}
      busy={save.isPending}
      confirmDisabled={!valid}
      onConfirm={() => save.mutate()}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {DECISIONS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setD(x)}
              aria-pressed={d === x}
              className={cn(
                "min-h-12 rounded-lg border px-2 text-sm font-medium",
                d === x ? "border-national bg-national text-white" : "bg-white",
              )}
            >
              {x}
            </button>
          ))}
        </div>
        {d !== "إلغاء" && (
          <Field label={d === "تنفيذ بموعد جديد" ? "الموعد الجديد" : "موعد جديد (اختياري)"}>
            <input
              type="date"
              min={today}
              className={inputCls}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
        )}
        {d === "إسناد لموظف آخر" && (
          <Field label="الموظف الجديد">
            <NativeSelect value={owner} onChange={setOwner}>
              <option value="">اختر</option>
              {(profiles.data ?? [])
                .filter((p) => p.is_active && p.team_id === task.team_id && p.id !== task.owner_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
        <Field label={d === "إلغاء" ? "سبب الإلغاء (مطلوب)" : "ملاحظة (اختياري)"}>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
