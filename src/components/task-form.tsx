import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Me } from "@/lib/auth";
import { daysBetween, riyadhToday } from "@/lib/format";
import { useProfiles, useTeams } from "@/lib/data";
import { CLASS_HINT, PRIORITIES } from "@/lib/constants";
import { Field, inputCls, NativeSelect } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type TaskFormValue = {
  title: string;
  description: string;
  team_id: string;
  owner_id: string;
  contributors: string[];
  start_date: string;
  due_date: string;
  priority: string;
  goal_id: string;
};

export function suggestClass(v: Pick<TaskFormValue, "start_date" | "due_date" | "contributors">) {
  if (v.start_date && v.due_date && daysBetween(v.start_date, v.due_date) > 30) return "طويلة";
  if (v.contributors.length) return "معقدة";
  return "قصيرة";
}

export function TaskForm({
  me,
  initial,
  submitLabel,
  busy,
  onSubmit,
  lockOwnerAndDue,
}: {
  me: Me;
  initial?: Partial<TaskFormValue>;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (v: TaskFormValue) => void;
  lockOwnerAndDue?: boolean;
}) {
  const today = riyadhToday();
  const teams = useTeams();
  const profiles = useProfiles();
  const [v, setV] = useState<TaskFormValue>({
    title: "",
    description: "",
    team_id: me.teamId ?? "",
    owner_id: me.id,
    contributors: [],
    start_date: today,
    due_date: "",
    priority: "عادية",
    goal_id: "",
    ...initial,
  });
  useEffect(() => {
    if (!v.team_id && me.teamId) setV((x) => ({ ...x, team_id: me.teamId! }));
  }, [me.teamId, v.team_id]);
  const set = <K extends keyof TaskFormValue>(k: K, val: TaskFormValue[K]) =>
    setV((x) => ({ ...x, [k]: val }));

  const goals = useQuery({
    queryKey: ["goals", "options", v.team_id],
    enabled: !!v.team_id,
    queryFn: async () =>
      (
        await supabase
          .from("annual_goals")
          .select("id, title, year")
          .eq("team_id", v.team_id)
          .eq("status", "نشط")
          .order("year", { ascending: false })
      ).data ?? [],
  });

  const members = useMemo(
    () =>
      (profiles.data ?? []).filter((p) => p.is_active && (!v.team_id || p.team_id === v.team_id)),
    [profiles.data, v.team_id],
  );
  const cls = suggestClass(v);
  const dur = v.start_date && v.due_date ? daysBetween(v.start_date, v.due_date) : 0;
  const pastDue = !!v.due_date && v.due_date < today;
  const canAssign = me.isStaff;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <Field label="عنوان المهمة">
        <input
          required
          maxLength={200}
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="مثال: تحديث خطة الإخلاء لمبنى NHC-2"
        />
      </Field>
      <Field label="الوصف (اختياري)">
        <Textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {me.isAdmin && (
          <Field label="الفريق">
            <NativeSelect
              required
              value={v.team_id}
              onChange={(x) =>
                setV((s) => ({ ...s, team_id: x, owner_id: me.id, contributors: [] }))
              }
            >
              <option value="">اختر الفريق</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field
          label="المسؤول (شخص واحد)"
          hint={!canAssign ? "تُنشأ المهمة باسمك. يستطيع مديرك إسنادها لغيرك." : undefined}
        >
          <NativeSelect
            required
            disabled={!canAssign || lockOwnerAndDue}
            value={v.owner_id}
            onChange={(x) =>
              setV((s) => ({
                ...s,
                owner_id: x,
                contributors: s.contributors.filter((c) => c !== x),
              }))
            }
          >
            {members.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
            {!members.some((m) => m.id === v.owner_id) && (
              <option value={v.owner_id}>{me.profile?.full_name}</option>
            )}
          </NativeSelect>
        </Field>
        <Field label="الأولوية">
          <NativeSelect value={v.priority} onChange={(x) => set("priority", x)}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="تاريخ البدء">
          <input
            type="date"
            value={v.start_date}
            onChange={(e) => set("start_date", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="تاريخ الاستحقاق">
          <input
            type="date"
            required
            disabled={lockOwnerAndDue}
            min={v.start_date || undefined}
            value={v.due_date}
            onChange={(e) => set("due_date", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="الهدف السنوي المرتبط (اختياري)">
          <NativeSelect value={v.goal_id} onChange={(x) => set("goal_id", x)}>
            <option value="">بدون</option>
            {(goals.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.year})
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {canAssign && (
        <Field
          label="المشاركون (اختياري)"
          hint="المشاركون يساعدون في التنفيذ، والمسؤولية على شخص واحد."
        >
          <div className="flex flex-wrap gap-2">
            {members
              .filter((p) => p.id !== v.owner_id)
              .map((p) => {
                const on = v.contributors.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      set(
                        "contributors",
                        on ? v.contributors.filter((c) => c !== p.id) : [...v.contributors, p.id],
                      )
                    }
                    className={
                      "min-h-9 rounded-full border px-3 text-sm " +
                      (on ? "border-leaf bg-mint text-national" : "bg-white text-ink")
                    }
                    aria-pressed={on}
                  >
                    {p.full_name}
                  </button>
                );
              })}
          </div>
        </Field>
      )}

      <div className="space-y-2 rounded-xl bg-water/60 p-3 text-sm">
        <div>
          <span className="font-bold text-national">التصنيف المقترح: {cls}</span>
          {cls === "طويلة"
            ? ` — المدة المخططة ${dur} يوماً. يُنصح بتحويلها إلى مشروع بعد الحفظ.`
            : ` — ${CLASS_HINT[cls]}`}
        </div>
        {pastDue && (
          <div className="flex items-start gap-2 text-alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            تاريخ الاستحقاق قبل اليوم، فستُعلَّم المهمة «سُجّلت بعد الموعد» ولن تُحسب في مؤشر
            الإنجاز في الموعد.
          </div>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={busy || !v.title.trim() || !v.due_date || !v.team_id}
        className="w-full sm:w-auto"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
