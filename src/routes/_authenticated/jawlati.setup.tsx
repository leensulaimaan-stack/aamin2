import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { useBuildings, useNames, useProfiles, useTeams, type Building } from "@/lib/data";
import { BUILDING_FEATURES, SEVERITIES } from "@/lib/constants";
import { useFmt } from "@/lib/format";
import {
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
  SeverityPill,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/jawlati/setup")({
  head: () => ({ meta: [{ title: "المباني والجولات | آمن" }] }),
  component: Setup,
});

function Setup() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<"buildings" | "plans" | "library">("buildings");
  if (me && !me.isStaff) return <Empty>هذه الصفحة لمديري الفرق.</Empty>;
  return (
    <div className="space-y-4">
      <PageTitle
        title="المباني والجولات الشهرية"
        sub="جولتي شهرية فقط: جولة شاملة لكل مبنى كل شهر، تُنشأ تلقائياً في بدايته مع مهمتها في «مهامي»"
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "buildings", label: "المباني" },
          { value: "plans", label: "خطة الجولات" },
          { value: "library", label: "مكتبة بنود الفحص" },
        ]}
      />
      {tab === "buildings" && <Buildings />}
      {tab === "plans" && <Plans />}
      {tab === "library" && <Library />}
    </div>
  );
}

function Buildings() {
  const { data: me } = useMe();
  const buildings = useBuildings();
  const name = useNames();
  const [edit, setEdit] = useState<Partial<Building> | null>(null);
  const canEdit = (b: { team_id: string | null }) =>
    !!me && (me.isAdmin || me.teamId === b.team_id);
  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEdit({ team_id: me?.teamId ?? null })}>
          <Plus className="h-4 w-4" /> مبنى جديد
        </Button>
      </div>
      {buildings.isLoading ? (
        <ListSkeleton />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(buildings.data ?? []).map((b) => (
            <Panel
              key={b.id}
              title={
                <span>
                  {b.code}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{b.name}</span>
                </span>
              }
              action={
                canEdit(b) && (
                  <Button size="sm" variant="ghost" onClick={() => setEdit(b)}>
                    <Pencil className="h-4 w-4" /> تعديل
                  </Button>
                )
              }
            >
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {b.floors_count ? `${b.floors_count} طوابق · ` : ""}مسؤول الإجراءات التصحيحية:{" "}
                  <b className="text-ink">{name(b.responsible_user_id)}</b>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BUILDING_FEATURES.filter(([k]) => b[k]).map(([k, l]) => (
                    <Pill key={k} tone="later">
                      {l}
                    </Pill>
                  ))}
                  {!BUILDING_FEATURES.some(([k]) => b[k]) && (
                    <span className="text-xs text-muted-foreground">
                      لم تُحدَّد مرافق خاصة؛ تظهر البنود العامة فقط.
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {edit && <BuildingDialog value={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function BuildingDialog({ value, onClose }: { value: Partial<Building>; onClose: () => void }) {
  const { data: me } = useMe();
  const teams = useTeams();
  const profiles = useProfiles();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<Building>>(value);
  const save = useMutation({
    mutationFn: async () => {
      const patch = {
        code: v.code!.trim(),
        name: v.name!.trim(),
        team_id: v.team_id ?? null,
        floors_count: v.floors_count ?? null,
        address: v.address ?? null,
        responsible_user_id: v.responsible_user_id || null,
        ...Object.fromEntries(BUILDING_FEATURES.map(([k]) => [k, !!v[k]])),
      };
      const { error } = v.id
        ? await supabase.from("buildings").update(patch).eq("id", v.id)
        : await supabase.from("buildings").insert(patch);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["buildings"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={v.id ? `تعديل ${v.code}` : "مبنى جديد"}
      confirmLabel="حفظ"
      busy={save.isPending}
      confirmDisabled={!v.code?.trim() || !v.name?.trim() || !v.team_id}
      onConfirm={() => save.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الرمز">
          <input
            className={inputCls}
            dir="ltr"
            value={v.code ?? ""}
            onChange={(e) => setV({ ...v, code: e.target.value })}
            placeholder="NHC-6"
          />
        </Field>
        <Field label="الاسم">
          <input
            className={inputCls}
            value={v.name ?? ""}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </Field>
        {me?.isAdmin && (
          <Field label="الفريق">
            <NativeSelect value={v.team_id ?? ""} onChange={(x) => setV({ ...v, team_id: x })}>
              <option value="">اختر</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="عدد الطوابق">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={v.floors_count ?? ""}
            onChange={(e) =>
              setV({ ...v, floors_count: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field
          label="مسؤول الإجراءات التصحيحية"
          className="sm:col-span-2"
          hint="تُسند إليه ملاحظات هذا المبنى تلقائياً بعد اعتماد الجولة"
        >
          <NativeSelect
            value={v.responsible_user_id ?? ""}
            onChange={(x) => setV({ ...v, responsible_user_id: x })}
          >
            <option value="">المفتش نفسه</option>
            {(profiles.data ?? [])
              .filter((p) => p.is_active && p.team_id === v.team_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="mt-3">
        <div className="mb-2 text-sm font-medium">مرافق المبنى (تحدد البنود التي تظهر للمفتش)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUILDING_FEATURES.map(([k, l]) => (
            <label
              key={k}
              className="flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 text-sm"
            >
              {l}
              <Switch checked={!!v[k]} onCheckedChange={(c) => setV({ ...v, [k]: c })} />
            </label>
          ))}
        </div>
      </div>
    </ConfirmDialog>
  );
}

function Plans() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const buildings = useBuildings();
  const profiles = useProfiles();
  const { n } = useFmt();
  const q = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const [t, p] = await Promise.all([
        supabase.from("inspection_templates").select("*").eq("active", true).order("name"),
        supabase.from("building_inspection_plans").select("*"),
      ]);
      return { templates: t.data ?? [], plans: p.data ?? [] };
    },
  });
  const upsert = useMutation({
    mutationFn: async (x: {
      building_id: string;
      template_id: string;
      assignee_id: string;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from("building_inspection_plans")
        .upsert(x, { onConflict: "building_id,template_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ. يُطبَّق على جولات الشهر القادم والجولات التي لم تُنشأ بعد.");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const tplUpdate = useMutation({
    mutationFn: async (x: { id: string; due_day: number }) => {
      const { error } = await supabase
        .from("inspection_templates")
        .update({ due_day: x.due_day })
        .eq("id", x.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("حُدّث يوم الاستحقاق");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (q.isLoading) return <ListSkeleton />;
  return (
    <div className="space-y-4">
      {q.data!.templates.map((t) => (
        <Panel
          key={t.id}
          title={t.name}
          action={
            <label className="flex items-center gap-2 text-sm">
              تستحق يوم
              <input
                type="number"
                min={1}
                max={31}
                defaultValue={t.due_day}
                disabled={!me?.isAdmin && t.team_id === null}
                onBlur={(e) =>
                  Number(e.target.value) !== t.due_day &&
                  tplUpdate.mutate({ id: t.id, due_day: Number(e.target.value) })
                }
                className={inputCls + " h-9 w-16"}
                aria-label="يوم الاستحقاق"
              />
              من كل شهر
            </label>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            شهرية · الأقسام: {t.section_codes.join("، ")} · {n(t.section_codes.length)} أقسام
          </p>
          <div className="space-y-2">
            {(buildings.data ?? []).map((b) => {
              const plan = q.data!.plans.find(
                (p) => p.building_id === b.id && p.template_id === t.id,
              );
              const canEdit = !!me && (me.isAdmin || me.teamId === b.team_id);
              return (
                <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <b className="w-16 text-national">{b.code}</b>
                  <NativeSelect
                    ariaLabel={`مفتش ${b.code}`}
                    disabled={!canEdit}
                    value={plan?.assignee_id ?? ""}
                    onChange={(x) =>
                      x &&
                      upsert.mutate({
                        building_id: b.id,
                        template_id: t.id,
                        assignee_id: x,
                        active: plan?.active ?? true,
                      })
                    }
                    className="max-w-xs flex-1"
                  >
                    <option value="">بدون مفتش (لا تُنشأ جولة)</option>
                    {(profiles.data ?? [])
                      .filter((p) => p.is_active && p.team_id === b.team_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </NativeSelect>
                  {plan && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        disabled={!canEdit}
                        checked={plan.active}
                        onCheckedChange={(c) =>
                          upsert.mutate({
                            building_id: b.id,
                            template_id: t.id,
                            assignee_id: plan.assignee_id,
                            active: c,
                          })
                        }
                      />
                      {plan.active ? "مفعّلة" : "موقوفة"}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Library() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { n } = useFmt();
  const [add, setAdd] = useState<{
    section_id: string;
    text: string;
    severity: string;
    applies_if: string;
  } | null>(null);
  const q = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const [s, i] = await Promise.all([
        supabase.from("checklist_sections").select("*").order("order_no"),
        supabase.from("checklist_items").select("*").order("order_no"),
      ]);
      return { sections: s.data ?? [], items: i.data ?? [] };
    },
  });
  const upd = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { text?: string; default_severity?: string; active?: boolean };
    }) => {
      const { error } = await supabase.from("checklist_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const ins = useMutation({
    mutationFn: async () => {
      const sec = q.data!.sections.find((s) => s.id === add!.section_id)!;
      const count = q.data!.items.filter((i) => i.section_id === sec.id).length;
      const { error } = await supabase.from("checklist_items").insert({
        section_id: sec.id,
        code: `${sec.code}${count + 1}`,
        text: add!.text.trim(),
        order_no: count + 1,
        default_severity: add!.severity,
        applies_if: add!.applies_if || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُضيف البند");
      setAdd(null);
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (q.isLoading) return <ListSkeleton />;
  const admin = !!me?.isAdmin;
  const featureLabel = Object.fromEntries(BUILDING_FEATURES);
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-arfaj p-3 text-sm">
        البنود مبنية على ممارسات عامة في السلامة والصحة المهنية، وليست نصاً من كود الحريق السعودي أو
        اشتراطات الدفاع المدني. راجعها مع إجراءات الشركة.{" "}
        {admin
          ? "تستطيع تعديل نص البند وخطورته، أو إيقافه، أو إضافة بنود جديدة."
          : "يعدّلها مدير الإدارة."}
      </p>
      {q.data!.sections.map((s) => {
        const items = q.data!.items.filter((i) => i.section_id === s.id);
        return (
          <Panel
            key={s.id}
            title={`${s.code}. ${s.name} (${n(items.filter((i) => i.active).length)})`}
            action={
              admin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setAdd({ section_id: s.id, text: "", severity: "متوسطة", applies_if: "" })
                  }
                >
                  <Plus className="h-4 w-4" /> بند
                </Button>
              )
            }
          >
            <div className="divide-y">
              {items.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                  <span className="w-12 text-xs text-muted-foreground">{i.code}</span>
                  {admin ? (
                    <input
                      aria-label="نص البند"
                      defaultValue={i.text}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== i.text &&
                        upd.mutate({ id: i.id, patch: { text: e.target.value.trim() } })
                      }
                      className="min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-1 focus:ring-1 focus:ring-leaf"
                    />
                  ) : (
                    <span
                      className={i.active ? "flex-1" : "flex-1 text-muted-foreground line-through"}
                    >
                      {i.text}
                    </span>
                  )}
                  {i.applies_if && (
                    <Pill tone="later">{featureLabel[i.applies_if] ?? i.applies_if}</Pill>
                  )}
                  {admin ? (
                    <NativeSelect
                      ariaLabel="الخطورة الافتراضية"
                      value={i.default_severity}
                      onChange={(x) => upd.mutate({ id: i.id, patch: { default_severity: x } })}
                      className="h-9 w-28"
                    >
                      {SEVERITIES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <SeverityPill sev={i.default_severity} />
                  )}
                  {admin && (
                    <Switch
                      checked={i.active}
                      onCheckedChange={(c) => upd.mutate({ id: i.id, patch: { active: c } })}
                      aria-label="تفعيل البند"
                    />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
      {add && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAdd(null)}
          title="بند فحص جديد"
          confirmLabel="إضافة"
          busy={ins.isPending}
          confirmDisabled={!add.text.trim()}
          onConfirm={() => ins.mutate()}
        >
          <div className="space-y-3">
            <Field label="نص البند">
              <input
                className={inputCls}
                value={add.text}
                onChange={(e) => setAdd({ ...add, text: e.target.value })}
              />
            </Field>
            <Field label="الخطورة الافتراضية">
              <NativeSelect value={add.severity} onChange={(x) => setAdd({ ...add, severity: x })}>
                {SEVERITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="يظهر فقط في المباني التي فيها" hint="اتركه فارغاً ليظهر في كل المباني">
              <NativeSelect
                value={add.applies_if}
                onChange={(x) => setAdd({ ...add, applies_if: x })}
              >
                <option value="">كل المباني</option>
                {BUILDING_FEATURES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
