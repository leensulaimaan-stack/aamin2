import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { riyadhToday, useFmt } from "@/lib/format";
import { useNames, useProfiles, useTeams } from "@/lib/data";
import { goalProgress, latestRag } from "@/lib/goals";
import {
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  PctRing,
  Pill,
  Segmented,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/goals/")({
  head: () => ({ meta: [{ title: "الأهداف السنوية | آمن" }] }),
  component: Goals,
});

function Goals() {
  const { data: me } = useMe();
  const name = useNames();
  const { n, date } = useFmt();
  const thisYear = Number(riyadhToday().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["goals", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annual_goals")
        .select(
          "*, goal_milestones!goal_milestones_goal_id_fkey(*), goal_checkins!goal_checkins_goal_id_fkey(*)",
        )
        .eq("year", year)
        .neq("status", "ملغى")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const list = (q.data ?? []).filter((g) => (tab === "mine" ? g.owner_id === me?.id : true));
  const myWeight = (q.data ?? [])
    .filter((g) => g.owner_id === me?.id)
    .reduce((s, g) => s + Number(g.weight), 0);
  const byOwner = new Map<string, number>();
  (q.data ?? []).forEach((g) =>
    byOwner.set(g.owner_id, (byOwner.get(g.owner_id) ?? 0) + Number(g.weight)),
  );
  const badOwners = [...byOwner.entries()].filter(([, w]) => w !== 100);

  return (
    <div>
      <PageTitle
        title="الأهداف السنوية"
        sub="متابعة منفصلة عن المهام اليومية: مستهدفات ربعية وتحديث كل ربع"
        action={
          <>
            <NativeSelect
              ariaLabel="السنة"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              className="w-28"
            >
              {[thisYear + 1, thisYear, thisYear - 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
            {me?.isStaff && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> هدف جديد
              </Button>
            )}
          </>
        }
      />
      {me?.isStaff && (
        <div className="mb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "mine", label: "أهدافي" },
              { value: "team", label: "أهداف الفريق" },
            ]}
          />
        </div>
      )}
      {tab === "mine" && list.length > 0 && myWeight !== 100 && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-arfaj p-3 text-sm">
          <AlertTriangle className="h-4 w-4" /> مجموع أوزان أهدافك {n(myWeight)}٪ ويُفترض أن يساوي
          100٪.
        </p>
      )}
      {tab === "team" && badOwners.length > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-arfaj p-3 text-sm">
          <AlertTriangle className="h-4 w-4" /> أوزان لا تساوي 100٪:{" "}
          {badOwners.map(([o, w]) => `${name(o)} (${n(w)}٪)`).join("، ")}
        </p>
      )}
      {q.isLoading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <Empty>
          {tab === "mine" ? "لا توجد أهداف مسندة إليك لهذه السنة." : "لا توجد أهداف لهذه السنة."}
          {me?.isStaff && " أضف هدفاً بالزر في الأعلى."}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g) => {
            const pct = goalProgress(g, g.goal_checkins, g.goal_milestones);
            const rag = latestRag(g.goal_checkins);
            const next = [...g.goal_milestones]
              .filter((m) => m.status !== "تحقق")
              .sort((a, b) => a.quarter - b.quarter)[0];
            return (
              <Link
                key={g.id}
                to="/goals/$id"
                params={{ id: g.id }}
                className="flex gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <PctRing pct={pct} size={84} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-national">{g.title}</span>
                    {rag && <Pill tone={rag} />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {name(g.owner_id)} · الوزن {n(Number(g.weight))}٪ · {g.measure_type}
                  </div>
                  {next && (
                    <div className="text-xs">
                      المستهدف التالي: الربع {n(next.quarter)} — {next.title}
                      {next.due_date ? ` (${date(next.due_date)})` : ""}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {open && me && <NewGoalDialog year={year} open={open} onOpenChange={setOpen} />}
    </div>
  );
}

function NewGoalDialog({
  year,
  open,
  onOpenChange,
}: {
  year: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const teams = useTeams();
  const profiles = useProfiles();
  const [v, setV] = useState({
    team_id: me?.teamId ?? "",
    owner_id: me?.id ?? "",
    title: "",
    description: "",
    measure_type: "نسبة مئوية",
    baseline_value: "0",
    target_value: "100",
    unit: "%",
    weight: "0",
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("annual_goals")
        .insert({
          year,
          team_id: v.team_id,
          owner_id: v.owner_id,
          title: v.title.trim(),
          description: v.description.trim() || null,
          measure_type: v.measure_type,
          baseline_value: Number(v.baseline_value),
          target_value: Number(v.target_value),
          unit: v.unit || null,
          weight: Number(v.weight),
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("goal_milestones").insert(
        [1, 2, 3, 4].map((q) => ({
          goal_id: data.id,
          quarter: q,
          title: `مستهدف الربع ${q}`,
          due_date: `${year}-${String(q * 3).padStart(2, "0")}-28`,
        })),
      );
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("أُضيف الهدف بأربعة مستهدفات ربعية يمكنك تعديلها");
      qc.invalidateQueries({ queryKey: ["goals"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`هدف جديد لسنة ${year}`}
      confirmLabel="إضافة"
      busy={create.isPending}
      confirmDisabled={!v.title.trim() || !v.team_id}
      onConfirm={() => create.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان الهدف" className="sm:col-span-2">
          <input
            className={inputCls}
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
          />
        </Field>
        <Field label="الوصف" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </Field>
        {me?.isAdmin && (
          <Field label="الفريق">
            <NativeSelect value={v.team_id} onChange={(x) => setV({ ...v, team_id: x })}>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="صاحب الهدف">
          <NativeSelect value={v.owner_id} onChange={(x) => setV({ ...v, owner_id: x })}>
            {(profiles.data ?? [])
              .filter((p) => p.is_active && p.team_id === v.team_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="طريقة القياس">
          <NativeSelect
            value={v.measure_type}
            onChange={(x) =>
              setV({
                ...v,
                measure_type: x,
                unit: x === "نسبة مئوية" ? "%" : x === "مراحل" ? "مرحلة" : "",
              })
            }
          >
            <option>نسبة مئوية</option>
            <option>عدد</option>
            <option>مراحل</option>
          </NativeSelect>
        </Field>
        {v.measure_type !== "مراحل" && (
          <>
            <Field label="خط الأساس">
              <input
                type="number"
                className={inputCls}
                value={v.baseline_value}
                onChange={(e) => setV({ ...v, baseline_value: e.target.value })}
              />
            </Field>
            <Field label="المستهدف">
              <input
                type="number"
                className={inputCls}
                value={v.target_value}
                onChange={(e) => setV({ ...v, target_value: e.target.value })}
              />
            </Field>
            <Field label="الوحدة">
              <input
                className={inputCls}
                value={v.unit}
                onChange={(e) => setV({ ...v, unit: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field label="الوزن ٪" hint="مجموع أوزان أهداف الشخص = 100">
          <input
            type="number"
            min={0}
            max={100}
            className={inputCls}
            value={v.weight}
            onChange={(e) => setV({ ...v, weight: e.target.value })}
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
