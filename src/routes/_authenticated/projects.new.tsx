import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { addDays, daysBetween, riyadhToday, useFmt } from "@/lib/format";
import { useNames, useProfiles, useTeams } from "@/lib/data";
import { Field, inputCls, ListSkeleton, NativeSelect, PageTitle, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/new")({
  head: () => ({ meta: [{ title: "مشروع جديد | آمن" }] }),
  validateSearch: (s: Record<string, unknown>): { from?: string | undefined } => ({
    from: typeof s["from"] === "string" ? (s["from"] as string) : undefined,
  }),
  component: NewProject,
});

type Phase = {
  title: string;
  deliverable: string;
  owner_id: string;
  start_date: string;
  due_date: string;
  depends_on_previous: boolean;
};

function NewProject() {
  const { from } = Route.useSearch();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profiles = useProfiles();
  const teams = useTeams();
  const name = useNames();
  const { date, n } = useFmt();
  const today = riyadhToday();
  const [step, setStep] = useState(1);
  const [d, setD] = useState({
    title: "",
    description: "",
    team_id: "",
    owner_id: "",
    start_date: today,
    due_date: "",
    goal_id: "",
  });
  const [phases, setPhases] = useState<Phase[]>([]);

  const source = useQuery({
    enabled: !!from,
    queryKey: ["task", from],
    queryFn: async () =>
      (await supabase.from("tasks").select("*").eq("id", from!).maybeSingle()).data,
  });
  const templates = useQuery({
    queryKey: ["phase-templates"],
    queryFn: async () =>
      (await supabase.from("phase_templates").select("*").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!me) return;
    const s = source.data;
    setD((x) => ({
      ...x,
      team_id: x.team_id || s?.team_id || me.teamId || "",
      owner_id: x.owner_id || s?.owner_id || me.id,
      title: x.title || s?.title || "",
      description: x.description || s?.description || "",
      start_date: s?.start_date || x.start_date,
      due_date: x.due_date || s?.due_date || "",
      goal_id: x.goal_id || s?.goal_id || "",
    }));
  }, [me, source.data]);

  const blank = (i: number, start = d.start_date): Phase => ({
    title: "",
    deliverable: "",
    owner_id: d.owner_id,
    start_date: addDays(start, i * 14),
    due_date: addDays(start, i * 14 + 13),
    depends_on_previous: i > 0,
  });
  function applyTemplate(id: string) {
    const t = (templates.data ?? []).find((x) => x.id === id);
    if (!t) return;
    let cur = d.start_date;
    const list = (t.phases as { title: string; deliverable: string; days: number }[]).map(
      (p, i) => {
        const ph: Phase = {
          title: p.title,
          deliverable: p.deliverable,
          owner_id: d.owner_id,
          start_date: cur,
          due_date: addDays(cur, Math.max(1, p.days) - 1),
          depends_on_previous: i > 0,
        };
        cur = addDays(ph.due_date, 1);
        return ph;
      },
    );
    setPhases(list);
  }
  const setP = (i: number, patch: Partial<Phase>) =>
    setPhases(phases.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= phases.length) return;
    const c = [...phases];
    const a = c[i]!;
    c[i] = c[j]!;
    c[j] = a;
    setPhases(c);
  };

  const members = (profiles.data ?? []).filter(
    (p) => p.is_active && (!d.team_id || p.team_id === d.team_id),
  );
  const phasesValid =
    phases.length > 0 &&
    phases.every((p) => p.title.trim() && p.deliverable.trim() && p.due_date && p.owner_id);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_project", {
        p_source_task: (from ?? null) as string,
        p_team: d.team_id,
        p_title: d.title.trim(),
        p_description: (d.description.trim() || null) as string,
        p_owner: d.owner_id,
        p_start: (d.start_date || null) as string,
        p_due: d.due_date,
        p_goal: (d.goal_id || null) as string,
        p_phases: phases.map((p) => ({
          ...p,
          title: p.title.trim(),
          deliverable: p.deliverable.trim(),
        })),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (pid) => {
      qc.invalidateQueries();
      toast.success(from ? "حُوّلت المهمة إلى مشروع" : "أُنشئ المشروع");
      navigate({ to: "/projects/$id", params: { id: pid } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!me || (from && source.isLoading)) return <ListSkeleton />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title={from ? "تحويل المهمة إلى مشروع" : "مشروع جديد"}
        sub={`الخطوة ${step} من 3 — ${["", "بيانات المشروع", "المراحل", "مراجعة وإنشاء"][step]}`}
      />
      <ol className="mb-4 flex gap-2" aria-hidden>
        {[1, 2, 3].map((s) => (
          <li
            key={s}
            className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-leaf" : "bg-water")}
          />
        ))}
      </ol>

      {step === 1 && (
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="عنوان المشروع" className="sm:col-span-2">
              <input
                className={inputCls}
                value={d.title}
                maxLength={200}
                onChange={(e) => setD({ ...d, title: e.target.value })}
              />
            </Field>
            <Field label="الوصف" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={d.description}
                onChange={(e) => setD({ ...d, description: e.target.value })}
              />
            </Field>
            {me.isAdmin && (
              <Field label="الفريق">
                <NativeSelect value={d.team_id} onChange={(v) => setD({ ...d, team_id: v })}>
                  {(teams.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="مسؤول المشروع">
              <NativeSelect
                disabled={!me.isStaff}
                value={d.owner_id}
                onChange={(v) => setD({ ...d, owner_id: v })}
              >
                {members.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
                {!members.some((m) => m.id === d.owner_id) && (
                  <option value={d.owner_id}>{name(d.owner_id)}</option>
                )}
              </NativeSelect>
            </Field>
            <Field label="تاريخ البدء">
              <input
                type="date"
                className={inputCls}
                value={d.start_date}
                onChange={(e) => setD({ ...d, start_date: e.target.value })}
              />
            </Field>
            <Field label="تاريخ الانتهاء">
              <input
                type="date"
                className={inputCls}
                value={d.due_date}
                min={d.start_date}
                onChange={(e) => setD({ ...d, due_date: e.target.value })}
              />
            </Field>
          </div>
          <Button
            className="mt-5"
            disabled={!d.title.trim() || !d.due_date || !d.team_id}
            onClick={() => {
              if (!phases.length) setPhases([0, 1, 2].map((i) => blank(i)));
              setStep(2);
            }}
          >
            التالي
          </Button>
        </Panel>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Panel>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="ابدأ من قالب (اختياري)" className="min-w-60 flex-1">
                <NativeSelect value="" onChange={applyTemplate}>
                  <option value="">اختر قالباً</option>
                  {(templates.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                variant="outline"
                onClick={() =>
                  setPhases([
                    ...phases,
                    blank(
                      phases.length,
                      phases.at(-1) ? addDays(phases.at(-1)!.due_date, 1) : d.start_date,
                    ),
                  ])
                }
              >
                <Plus className="h-4 w-4" /> مرحلة
              </Button>
            </div>
          </Panel>
          {phases.map((p, i) => {
            const len = p.start_date && p.due_date ? daysBetween(p.start_date, p.due_date) + 1 : 0;
            return (
              <Panel
                key={i}
                title={`المرحلة ${n(i + 1)}`}
                action={
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="تحريك للأعلى"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="تحريك للأسفل"
                      disabled={i === phases.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف المرحلة"
                      className="text-alert"
                      onClick={() => setPhases(phases.filter((_, k) => k !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="العنوان">
                    <input
                      className={inputCls}
                      value={p.title}
                      onChange={(e) => setP(i, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="النتيجة المطلوبة">
                    <input
                      className={inputCls}
                      value={p.deliverable}
                      onChange={(e) => setP(i, { deliverable: e.target.value })}
                    />
                  </Field>
                  <Field label="المسؤول">
                    <NativeSelect value={p.owner_id} onChange={(v) => setP(i, { owner_id: v })}>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="البدء">
                    <input
                      type="date"
                      className={inputCls}
                      value={p.start_date}
                      onChange={(e) => setP(i, { start_date: e.target.value })}
                    />
                  </Field>
                  <Field label="الاستحقاق">
                    <input
                      type="date"
                      className={inputCls}
                      value={p.due_date}
                      min={p.start_date}
                      onChange={(e) => setP(i, { due_date: e.target.value })}
                    />
                  </Field>
                  {i > 0 && (
                    <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                      <input
                        type="checkbox"
                        checked={p.depends_on_previous}
                        onChange={(e) => setP(i, { depends_on_previous: e.target.checked })}
                        className="h-4 w-4 accent-[var(--leaf)]"
                      />
                      تبدأ بعد اكتمال المرحلة السابقة
                    </label>
                  )}
                </div>
                {len > 14 && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-alert">
                    <AlertTriangle className="h-4 w-4" /> يُفضّل ألا تتجاوز المرحلة أسبوعين (المدة
                    الحالية {n(len)} يوماً).
                  </p>
                )}
              </Panel>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              السابق
            </Button>
            <Button disabled={!phasesValid} onClick={() => setStep(3)}>
              التالي
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Panel>
          <h2 className="text-lg">{d.title}</h2>
          <p className="text-sm text-muted-foreground">
            {name(d.owner_id)} · {date(d.start_date)} — {date(d.due_date)}
          </p>
          <ol className="mt-4 space-y-2">
            {phases.map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-water/50 p-3 text-sm"
              >
                <b className="text-national">
                  {n(i + 1)}. {p.title}
                </b>
                <span className="text-muted-foreground">— {p.deliverable}</span>
                <span className="ms-auto text-xs">
                  {name(p.owner_id)} · {date(p.due_date)}
                </span>
              </li>
            ))}
          </ol>
          {from && (
            <p className="mt-3 rounded-xl bg-arfaj p-3 text-sm">
              ستُغلق المهمة الأصلية بحالة «ملغاة» وسبب «حُوّلت إلى مشروع»، مع رابط إلى المشروع.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              السابق
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              إنشاء المشروع
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
