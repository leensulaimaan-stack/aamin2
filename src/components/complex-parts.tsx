import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/auth";
import { daysBetween, riyadhToday, useFmt } from "@/lib/format";
import { useNames, useProfiles } from "@/lib/data";
import { PARTY_TYPES } from "@/lib/constants";
import { ConfirmDialog, Empty, Field, inputCls, NativeSelect, Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StepsPanel({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { n } = useFmt();
  const [title, setTitle] = useState("");
  const steps = useQuery({
    queryKey: ["steps", taskId],
    queryFn: async () =>
      (await supabase.from("task_steps").select("*").eq("task_id", taskId).order("order_no"))
        .data ?? [],
  });
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["steps", taskId] });
    qc.invalidateQueries({ queryKey: ["complex"] });
  };
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("task_steps")
        .insert({ task_id: taskId, title: title.trim(), order_no: (steps.data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      inv();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: async (s: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from("task_steps")
        .update({ is_done: !s.is_done, done_at: !s.is_done ? new Date().toISOString() : null })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: inv,
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const list = steps.data ?? [];
  const done = list.filter((s) => s.is_done).length;
  return (
    <Panel title={list.length ? `الخطوات (${n(done)} من ${n(list.length)})` : "الخطوات"}>
      <div className="space-y-2">
        {list.length === 0 && <Empty>قسّم العمل إلى خطوات قصيرة وواضحة.</Empty>}
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl border p-2.5">
            <button
              disabled={!canEdit}
              onClick={() => toggle.mutate(s)}
              className="grid h-8 w-8 place-items-center"
              aria-label={s.is_done ? "إلغاء الإنجاز" : "تم"}
            >
              {s.is_done ? (
                <CheckCircle2 className="h-5 w-5 text-leaf" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <span
              className={cn("flex-1 text-sm", s.is_done && "text-muted-foreground line-through")}
            >
              {s.title}
            </span>
            {canEdit && (
              <button
                onClick={() => del.mutate(s.id)}
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-alert"
                aria-label="حذف الخطوة"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) add.mutate();
            }}
          >
            <input
              aria-label="خطوة جديدة"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="خطوة جديدة"
              className={inputCls}
            />
            <Button disabled={!title.trim()} aria-label="إضافة خطوة">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </Panel>
  );
}

export function DependenciesPanel({
  taskId,
  canEdit,
  onChange,
}: {
  taskId: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const { date, n } = useFmt();
  const name = useNames();
  const today = riyadhToday();
  const [open, setOpen] = useState(false);
  const deps = useQuery({
    queryKey: ["deps", taskId],
    queryFn: async () =>
      (
        await supabase
          .from("external_dependencies")
          .select("*")
          .eq("task_id", taskId)
          .order("requested_on")
      ).data ?? [],
  });
  const receive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("external_dependencies")
        .update({ status: "تم الاستلام", received_on: today })
        .eq("id", id);
      if (error) throw error;
      const { data } = await supabase
        .from("external_dependencies")
        .select("id")
        .eq("task_id", taskId)
        .eq("status", "مطلوب");
      return (data ?? []).length;
    },
    onSuccess: async (left) => {
      qc.invalidateQueries({ queryKey: ["deps", taskId] });
      onChange();
      if (left === 0) {
        const { data: t } = await supabase.from("tasks").select("status").eq("id", taskId).single();
        if (t?.status === "بانتظار جهة خارجية")
          toast("تم استلام كل المتطلبات. هل تعيد المهمة إلى قيد التنفيذ؟", {
            action: {
              label: "نعم",
              onClick: async () => {
                await supabase.from("tasks").update({ status: "قيد التنفيذ" }).eq("id", taskId);
                onChange();
              },
            },
          });
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Panel
      title="الجهات الخارجية"
      action={
        canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> إضافة
          </Button>
        )
      }
    >
      <div className="space-y-2">
        {(deps.data ?? []).length === 0 && (
          <Empty>لا تنتظر هذه المهمة أي جهة. أضف الجهة إن كان جزء من العمل متوقفاً عليها.</Empty>
        )}
        {(deps.data ?? []).map((d) => {
          const waiting = d.status === "مطلوب" ? daysBetween(d.requested_on, today) : null;
          const pastExpected = d.status === "مطلوب" && d.expected_by && d.expected_by < today;
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
            >
              <Pill tone="بانتظار جهة خارجية">{d.party_type}</Pill>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{d.what_is_needed}</div>
                <div className="text-xs text-muted-foreground">
                  {d.party_name} · طُلب {date(d.requested_on)}
                  {d.expected_by ? ` · متوقع ${date(d.expected_by)}` : ""} · المتابع:{" "}
                  {name(d.follow_up_owner_id)}
                </div>
              </div>
              {waiting !== null && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                    pastExpected ? "bg-alert text-white" : "bg-water text-ink",
                  )}
                >
                  ينتظر {n(waiting)} يوماً
                </span>
              )}
              {d.status !== "مطلوب" && (
                <Pill tone={d.status === "تم الاستلام" ? "مكتملة" : "ملغاة"}>{d.status}</Pill>
              )}
              {canEdit && d.status === "مطلوب" && (
                <Button size="sm" variant="outline" onClick={() => receive.mutate(d.id)}>
                  تم الاستلام
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {open && (
        <AddDependency
          taskId={taskId}
          open={open}
          onOpenChange={setOpen}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["deps", taskId] });
            onChange();
          }}
        />
      )}
    </Panel>
  );
}

function AddDependency({
  taskId,
  open,
  onOpenChange,
  onDone,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const profiles = useProfiles();
  const today = riyadhToday();
  const [v, setV] = useState({
    party_type: "مشتريات",
    party_name: "",
    what_is_needed: "",
    requested_on: today,
    expected_by: "",
    follow_up_owner_id: "",
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("external_dependencies").insert({
        task_id: taskId,
        ...v,
        expected_by: v.expected_by || null,
        follow_up_owner_id: v.follow_up_owner_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُضيفت الجهة");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="جهة خارجية مطلوبة"
      confirmLabel="إضافة"
      busy={add.isPending}
      confirmDisabled={!v.party_name.trim() || !v.what_is_needed.trim()}
      onConfirm={() => add.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نوع الجهة">
          <NativeSelect value={v.party_type} onChange={(x) => setV({ ...v, party_type: x })}>
            {PARTY_TYPES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="اسم الجهة">
          <input
            className={inputCls}
            value={v.party_name}
            onChange={(e) => setV({ ...v, party_name: e.target.value })}
          />
        </Field>
        <Field label="المطلوب منها" className="sm:col-span-2">
          <input
            className={inputCls}
            value={v.what_is_needed}
            onChange={(e) => setV({ ...v, what_is_needed: e.target.value })}
          />
        </Field>
        <Field label="تاريخ الطلب">
          <input
            type="date"
            className={inputCls}
            value={v.requested_on}
            onChange={(e) => setV({ ...v, requested_on: e.target.value })}
          />
        </Field>
        <Field label="التاريخ المتوقع">
          <input
            type="date"
            className={inputCls}
            value={v.expected_by}
            onChange={(e) => setV({ ...v, expected_by: e.target.value })}
          />
        </Field>
        <Field label="من يتابع" className="sm:col-span-2">
          <NativeSelect
            value={v.follow_up_owner_id}
            onChange={(x) => setV({ ...v, follow_up_owner_id: x })}
          >
            <option value="">مسؤول المهمة</option>
            {(profiles.data ?? [])
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
        </Field>
      </div>
    </ConfirmDialog>
  );
}

/** 3-step wizard: one owner → short steps → move waiting parts to dependencies */
export function SimplifyDialog({
  task,
  contributors,
  open,
  onOpenChange,
  onDone,
}: {
  task: { id: string; owner_id: string; team_id: string };
  contributors: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const name = useNames();
  const [step, setStep] = useState(1);
  const people = [task.owner_id, ...contributors.filter((c) => c !== task.owner_id)];
  const [owner, setOwner] = useState(task.owner_id);
  const [steps, setSteps] = useState<string[]>([""]);
  const [deps, setDeps] = useState<
    { party_type: string; party_name: string; what_is_needed: string }[]
  >([]);
  const save = useMutation({
    mutationFn: async () => {
      if (owner !== task.owner_id) {
        const { error } = await supabase
          .from("tasks")
          .update({ owner_id: owner })
          .eq("id", task.id);
        if (error) throw error;
        await supabase
          .from("task_contributors")
          .delete()
          .eq("task_id", task.id)
          .eq("user_id", owner);
        await supabase
          .from("task_contributors")
          .insert({ task_id: task.id, user_id: task.owner_id });
      }
      const s = steps.map((x) => x.trim()).filter(Boolean);
      if (s.length) {
        const { count } = await supabase
          .from("task_steps")
          .select("id", { count: "exact", head: true })
          .eq("task_id", task.id);
        const { error } = await supabase
          .from("task_steps")
          .insert(
            s.map((title, i) => ({ task_id: task.id, title, order_no: (count ?? 0) + i + 1 })),
          );
        if (error) throw error;
      }
      const d = deps.filter((x) => x.party_name.trim() && x.what_is_needed.trim());
      if (d.length) {
        const { error } = await supabase
          .from("external_dependencies")
          .insert(d.map((x) => ({ task_id: task.id, ...x })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("بُسّطت المهمة");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`تبسيط المهمة — الخطوة ${step} من 3`}
      description={
        [
          "",
          "اختر مسؤولاً واحداً عن النتيجة. يصبح الباقون مشاركين.",
          "قسّم العمل إلى خطوات قليلة وواضحة.",
          "افصل ما ينتظر جهات أخرى حتى يستمر باقي العمل.",
        ][step]
      }
      confirmLabel={step < 3 ? "التالي" : "حفظ"}
      busy={save.isPending}
      onConfirm={() => (step < 3 ? setStep(step + 1) : save.mutate())}
    >
      {step === 1 && (
        <div className="space-y-2">
          {people.map((p) => (
            <label key={p} className="flex min-h-11 items-center gap-3 rounded-xl border px-3">
              <input
                type="radio"
                name="owner"
                checked={owner === p}
                onChange={() => setOwner(p)}
                className="accent-[var(--leaf)]"
              />
              {name(p)}
            </label>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-2">
          {steps.map((s, i) => (
            <input
              key={i}
              aria-label={`الخطوة ${i + 1}`}
              className={inputCls}
              value={s}
              placeholder={`الخطوة ${i + 1}`}
              onChange={(e) => setSteps(steps.map((x, k) => (k === i ? e.target.value : x)))}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => setSteps([...steps, ""])}>
            <Plus className="h-4 w-4" /> خطوة
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          {deps.map((d, i) => (
            <div key={i} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-3">
              <NativeSelect
                value={d.party_type}
                onChange={(x) =>
                  setDeps(deps.map((y, k) => (k === i ? { ...y, party_type: x } : y)))
                }
              >
                {PARTY_TYPES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </NativeSelect>
              <input
                aria-label="اسم الجهة"
                className={inputCls}
                placeholder="اسم الجهة"
                value={d.party_name}
                onChange={(e) =>
                  setDeps(deps.map((y, k) => (k === i ? { ...y, party_name: e.target.value } : y)))
                }
              />
              <input
                aria-label="المطلوب"
                className={inputCls}
                placeholder="المطلوب منها"
                value={d.what_is_needed}
                onChange={(e) =>
                  setDeps(
                    deps.map((y, k) => (k === i ? { ...y, what_is_needed: e.target.value } : y)),
                  )
                }
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDeps([...deps, { party_type: "مشتريات", party_name: "", what_is_needed: "" }])
            }
          >
            <Plus className="h-4 w-4" /> جهة خارجية
          </Button>
        </div>
      )}
    </ConfirmDialog>
  );
}
