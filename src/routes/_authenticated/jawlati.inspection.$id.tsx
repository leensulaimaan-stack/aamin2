import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MinusCircle,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, uploadPhotos, useMe } from "@/lib/auth";
import { riyadhDate, riyadhToday, useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { SEVERITIES } from "@/lib/constants";
import {
  Bar,
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  PageTitle,
  Panel,
  PhotoStrip,
  Pill,
  SeverityPill,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jawlati/inspection/$id")({
  head: () => ({ meta: [{ title: "الجولة | آمن" }] }),
  component: InspectionPage,
});

type Result = "مطابق" | "غير مطابق" | "لا ينطبق";
type Answer = {
  result?: Result | undefined;
  severity?: string | undefined;
  note?: string | undefined;
  photo_paths: string[];
  floor_or_area?: string | undefined;
};
type Item = {
  item_id: string;
  section_code: string;
  section_name: string;
  section_order: number;
  code: string;
  text: string;
  item_order: number;
  default_severity: string;
  photo_required_on_issue: boolean;
};

const draftKey = (id: string) => `aamin-inspection-draft-${id}`;
function loadDraft(id: string): Record<string, Answer> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}");
  } catch {
    return {};
  }
}
function saveDraft(id: string, a: Record<string, Answer>) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(a));
  } catch {
    /* storage full or blocked: the answers stay in memory */
  }
}

function InspectionPage() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const q = useQuery({
    queryKey: ["inspection", id],
    queryFn: async () => {
      const [i, items, answers] = await Promise.all([
        supabase
          .from("inspections")
          .select(
            "*, buildings!inspections_building_id_fkey(*), inspection_templates!inspections_template_id_fkey(name)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase.rpc("inspection_items", { _inspection: id }),
        supabase.from("inspection_answers").select("*").eq("inspection_id", id),
      ]);
      if (i.error) throw i.error;
      return { i: i.data, items: (items.data ?? []) as Item[], answers: answers.data ?? [] };
    },
  });
  if (q.isLoading || !me) return <ListSkeleton rows={6} />;
  const d = q.data;
  if (!d?.i) return <Empty>لم نجد هذه الجولة، أو ليست لديك صلاحية عرضها.</Empty>;
  const editable =
    d.i.assignee_id === me.id && ["لم تبدأ", "قيد التنفيذ", "مرفوضة"].includes(d.i.status);
  return editable ? (
    <Runner insp={d.i} items={d.items} previous={d.answers} />
  ) : (
    <Review insp={d.i} items={d.items} answers={d.answers} />
  );
}

type Insp = NonNullable<Awaited<ReturnType<typeof fetchType>>>;
// helper only for typing
async function fetchType() {
  return (
    await supabase
      .from("inspections")
      .select(
        "*, buildings!inspections_building_id_fkey(*), inspection_templates!inspections_template_id_fkey(name)",
      )
      .limit(1)
      .maybeSingle()
  ).data;
}

function Runner({
  insp,
  items,
  previous,
}: {
  insp: Insp;
  items: Item[];
  previous: {
    item_id: string;
    result: string;
    severity: string | null;
    note: string | null;
    photo_paths: string[];
    floor_or_area: string | null;
  }[];
}) {
  const { data: me } = useMe();
  const { n, date } = useFmt();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = riyadhToday();
  const sections = useMemo(() => {
    const m = new Map<string, { code: string; name: string; items: Item[] }>();
    items.forEach((it) => {
      if (!m.has(it.section_code))
        m.set(it.section_code, { code: it.section_code, name: it.section_name, items: [] });
      m.get(it.section_code)!.items.push(it);
    });
    return [...m.values()];
  }, [items]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const [sameDay, setSameDay] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const draft = loadDraft(insp.id);
    if (Object.keys(draft).length) setAnswers(draft);
    else if (previous.length) {
      // a rejected inspection starts from what was sent before
      setAnswers(
        Object.fromEntries(
          previous.map((p) => [
            p.item_id,
            {
              result: p.result as Result,
              severity: p.severity ?? undefined,
              note: p.note ?? undefined,
              photo_paths: p.photo_paths,
              floor_or_area: p.floor_or_area ?? undefined,
            },
          ]),
        ),
      );
    }
    if (insp.status === "لم تبدأ")
      supabase
        .rpc("start_inspection", { p_id: insp.id })
        .then(() => qc.invalidateQueries({ queryKey: ["tasks"] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insp.id]);

  const set = (itemId: string, patch: Partial<Answer>) =>
    setAnswers((a) => {
      const next = { ...a, [itemId]: { photo_paths: [], ...a[itemId], ...patch } };
      saveDraft(insp.id, next);
      return next;
    });

  const isDone = (it: Item) => {
    const a = answers[it.item_id];
    if (!a?.result) return false;
    if (a.result === "غير مطابق" && it.photo_required_on_issue && !a.photo_paths.length)
      return false;
    return true;
  };
  const answered = items.filter(isDone).length;
  const ok = items.filter((it) => answers[it.item_id]?.result === "مطابق").length;
  const bad = items.filter((it) => answers[it.item_id]?.result === "غير مطابق");
  const compliance = ok + bad.length ? Math.round((1000 * ok) / (ok + bad.length)) / 10 : 100;
  const onTime = today <= insp.due_date;
  const pts =
    (onTime ? 10 : 0) +
    (sameDay ? 5 : 0) +
    (bad.some((b) => answers[b.item_id]?.photo_paths.length) ? 3 : 0);
  const summary = step === sections.length;
  const sec = sections[step];

  async function addPhotos(it: Item, files: FileList | null) {
    if (!files?.length || !me) return;
    setUploading(it.item_id);
    try {
      const paths = await uploadPhotos(
        me.id,
        `inspections/${insp.id}`,
        Array.from(files).slice(0, 4),
      );
      set(it.item_id, { photo_paths: [...(answers[it.item_id]?.photo_paths ?? []), ...paths] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(null);
    }
  }

  const submit = useMutation({
    mutationFn: async () => {
      const payload = items.map((it) => {
        const a = answers[it.item_id];
        return {
          item_id: it.item_id,
          result: a?.result,
          severity: a?.result === "غير مطابق" ? (a.severity ?? it.default_severity) : null,
          note: a?.note ?? null,
          photo_paths: a?.photo_paths ?? [],
          floor_or_area: a?.floor_or_area ?? null,
        };
      });
      const { data, error } = await supabase.rpc("submit_inspection", {
        p_id: insp.id,
        p_answers: payload,
        p_same_day: sameDay,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(draftKey(insp.id));
      } catch {
        /* ignore */
      }
      toast.success("أُرسلت الجولة للاعتماد");
      qc.invalidateQueries();
      navigate({ to: "/jawlati" });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <Link to="/jawlati" className="inline-flex items-center gap-1 text-sm font-medium text-leaf">
        <ArrowRight className="h-4 w-4" /> جولتي
      </Link>
      <div className="rounded-2xl bg-national p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-mint">{insp.buildings?.code}</div>
            <div className="text-sm text-white/85">
              {insp.buildings?.name} · {insp.inspection_templates?.name}
            </div>
            <div className="mt-1 text-xs text-white/75">الموعد: {date(insp.due_date)}</div>
          </div>
          {insp.status === "مرفوضة" && <Pill tone="مرفوضة">أُعيدت للتعديل</Pill>}
        </div>
        {insp.rejection_reason && insp.status === "مرفوضة" && (
          <p className="mt-3 rounded-lg bg-white/10 p-2 text-sm">
            سبب الإعادة: {insp.rejection_reason}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs">
          <Bar pct={(100 * answered) / Math.max(1, items.length)} tone="bg-mint" />
          <span className="shrink-0 tabular-nums">
            {n(answered)}/{n(items.length)}
          </span>
        </div>
        <div
          className="mt-3 flex gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label="أقسام الجولة"
        >
          {sections.map((s, i) => {
            const done = s.items.every(isDone);
            return (
              <button
                key={s.code}
                onClick={() => setStep(i)}
                role="tab"
                aria-selected={step === i}
                className={cn(
                  "h-9 min-w-9 shrink-0 rounded-lg px-2 text-sm font-bold",
                  step === i
                    ? "bg-mint text-national"
                    : done
                      ? "bg-leaf text-white"
                      : "bg-white/10 text-white",
                )}
              >
                {s.code}
              </button>
            );
          })}
          <button
            onClick={() => setStep(sections.length)}
            role="tab"
            aria-selected={summary}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3 text-sm font-bold",
              summary ? "bg-mint text-national" : "bg-white/10 text-white",
            )}
          >
            الملخص
          </button>
        </div>
      </div>

      {!summary && sec && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">
              القسم {n(step + 1)} من {n(sections.length)}: {sec.name}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sec.items.forEach(
                  (it) => !answers[it.item_id]?.result && set(it.item_id, { result: "مطابق" }),
                )
              }
            >
              تطبيق «مطابق» على البنود المتبقية
            </Button>
          </div>
          <div className="space-y-3">
            {sec.items.map((it) => {
              const a = answers[it.item_id];
              return (
                <div
                  key={it.item_id}
                  className={cn(
                    "rounded-2xl border bg-card p-4",
                    a?.result === "غير مطابق" && "border-alert/60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs font-bold text-muted-foreground">
                      {it.code}
                    </span>
                    <p className="flex-1 font-medium">{it.text}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["مطابق", "غير مطابق", "لا ينطبق"] as Result[]).map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          set(it.item_id, {
                            result: r,
                            severity:
                              r === "غير مطابق" ? (a?.severity ?? it.default_severity) : undefined,
                          })
                        }
                        aria-pressed={a?.result === r}
                        className={cn(
                          "flex min-h-12 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors",
                          a?.result === r
                            ? r === "مطابق"
                              ? "border-leaf bg-leaf text-white"
                              : r === "غير مطابق"
                                ? "border-alert bg-alert text-white"
                                : "border-ink bg-ink text-white"
                            : "bg-white text-ink hover:bg-water/50",
                        )}
                      >
                        {r === "مطابق" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : r === "غير مطابق" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <MinusCircle className="h-4 w-4" />
                        )}
                        {r}
                      </button>
                    ))}
                  </div>
                  {a?.result === "غير مطابق" && (
                    <div className="mt-3 space-y-3 rounded-xl bg-sun/60 p-3">
                      <Field label="درجة الخطورة">
                        <div className="grid grid-cols-4 gap-1.5">
                          {SEVERITIES.map((s) => (
                            <button
                              key={s}
                              onClick={() => set(it.item_id, { severity: s })}
                              aria-pressed={(a.severity ?? it.default_severity) === s}
                              className={cn(
                                "min-h-10 rounded-lg border text-xs font-bold",
                                (a.severity ?? it.default_severity) === s
                                  ? "border-national bg-national text-white"
                                  : "bg-white",
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="الموقع (الطابق / المنطقة)">
                          <input
                            className={inputCls}
                            value={a.floor_or_area ?? ""}
                            onChange={(e) => set(it.item_id, { floor_or_area: e.target.value })}
                          />
                        </Field>
                        <Field label="وصف الملاحظة">
                          <input
                            className={inputCls}
                            value={a.note ?? ""}
                            onChange={(e) => set(it.item_id, { note: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium">
                          الصور{" "}
                          {it.photo_required_on_issue && (
                            <span className="text-alert">(مطلوبة)</span>
                          )}
                        </span>
                        <PhotoStrip paths={a.photo_paths} />
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-leaf bg-white px-4 text-sm font-medium text-leaf">
                          {uploading === it.item_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          {uploading === it.item_id ? "جارٍ الرفع…" : "التقط أو أرفق صورة"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="sr-only"
                            disabled={!!uploading}
                            onChange={(e) => addPhotos(it, e.target.files)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {summary && (
        <div className="space-y-3">
          <Panel title="ملخص الجولة">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-mint/60 p-3">
                <div className="text-2xl font-bold text-national tabular-nums">{n(ok)}</div>
                <div className="text-xs">مطابق</div>
              </div>
              <div className="rounded-xl bg-alert/15 p-3">
                <div className="text-2xl font-bold text-alert tabular-nums">{n(bad.length)}</div>
                <div className="text-xs">غير مطابق</div>
              </div>
              <div className="rounded-xl bg-water p-3">
                <div className="text-2xl font-bold text-national tabular-nums">
                  {n(items.filter((it) => answers[it.item_id]?.result === "لا ينطبق").length)}
                </div>
                <div className="text-xs">لا ينطبق</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm">نسبة الامتثال</span>
              <Bar pct={compliance} />
              <b className="tabular-nums">{n(compliance, 1)}٪</b>
            </div>
            {answered < items.length && (
              <p className="mt-3 rounded-xl bg-arfaj p-3 text-sm">
                بقي {n(items.length - answered)} بنداً دون إجابة أو بدون صورة مطلوبة. الأقسام
                الناقصة:{" "}
                {sections
                  .filter((s) => !s.items.every(isDone))
                  .map((s) => s.code)
                  .join("، ")}
              </p>
            )}
          </Panel>
          {bad.length > 0 && (
            <Panel title="الملاحظات المرصودة">
              <ul className="space-y-2">
                {bad.map((it) => (
                  <li
                    key={it.item_id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm"
                  >
                    <SeverityPill sev={answers[it.item_id]?.severity ?? it.default_severity} />
                    <span className="flex-1">{it.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {n(answers[it.item_id]?.photo_paths.length ?? 0)} صورة
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={sameDay}
                onChange={(e) => setSameDay(e.target.checked)}
                className="h-5 w-5 accent-[var(--leaf)]"
              />
              رُفع التقرير اليوم (في يوم تنفيذ الجولة)
            </label>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint/50 p-3 text-sm">
              <Star className="h-5 w-5 text-leaf" />
              ستحصل على <b className="text-base text-national">{n(pts)}</b> نقطة إذا اعتمد مديرك
              الجولة{!onTime && " (الجولة بعد موعدها، فلا تُحتسب نقاط الموعد)"}.
            </div>
          </Panel>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 p-3 backdrop-blur lg:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronRight className="h-4 w-4" /> السابق
          </Button>
          {!summary ? (
            <Button
              className="flex-1"
              onClick={() => {
                setStep(step + 1);
                window.scrollTo({ top: 0 });
              }}
            >
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 bg-leaf hover:bg-leaf/90"
              disabled={answered < items.length || submit.isPending || !!uploading}
              onClick={() => setConfirm(true)}
            >
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إرسال للاعتماد
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="إرسال الجولة للاعتماد"
        description={`${n(bad.length)} ملاحظة غير مطابقة · امتثال ${n(compliance, 1)}٪. لا يمكن التعديل بعد الإرسال إلا إذا أعادها المدير.`}
        confirmLabel="إرسال"
        busy={submit.isPending}
        onConfirm={() => {
          setConfirm(false);
          submit.mutate();
        }}
      />
    </div>
  );
}

function Review({
  insp,
  items,
  answers,
}: {
  insp: Insp;
  items: Item[];
  answers: {
    item_id: string;
    result: string;
    severity: string | null;
    note: string | null;
    photo_paths: string[];
    floor_or_area: string | null;
  }[];
}) {
  const { data: me } = useMe();
  const { n, date } = useFmt();
  const name = useNames();
  const qc = useQueryClient();
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const byItem = new Map(answers.map((a) => [a.item_id, a]));
  const canReview =
    !!me?.isStaff &&
    insp.status === "بانتظار الاعتماد" &&
    (me.isAdmin || me.teamId === insp.buildings?.team_id);
  const act = useMutation({
    mutationFn: async (kind: "approve" | "reject") => {
      const { error } =
        kind === "approve"
          ? await supabase.rpc("approve_inspection", { p_id: insp.id })
          : await supabase.rpc("reject_inspection", { p_id: insp.id, p_reason: reason.trim() });
      if (error) throw error;
      return kind;
    },
    onSuccess: (k) => {
      toast.success(
        k === "approve" ? "اعتُمدت الجولة وأُنشئت الإجراءات التصحيحية" : "أُعيدت الجولة للمفتش",
      );
      setReject(false);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const bad = items.filter((it) => byItem.get(it.item_id)?.result === "غير مطابق");
  const onTime = insp.submitted_at ? riyadhDate(insp.submitted_at) <= insp.due_date : false;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to={me?.isStaff ? "/jawlati/approvals" : "/jawlati"}
        className="inline-flex items-center gap-1 text-sm font-medium text-leaf"
      >
        <ArrowRight className="h-4 w-4" /> رجوع
      </Link>
      <PageTitle
        title={`${insp.buildings?.code} — ${insp.inspection_templates?.name}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={insp.status} />
            المفتش: {name(insp.assignee_id)} · الموعد {date(insp.due_date)}
            {insp.submitted_at && ` · أُرسلت ${date(riyadhDate(insp.submitted_at))}`}
            {insp.submitted_at && (
              <Pill tone={onTime ? "مكتملة" : "overdue"}>{onTime ? "في الموعد" : "متأخرة"}</Pill>
            )}
          </span>
        }
        action={
          canReview && (
            <>
              <Button
                className="bg-leaf hover:bg-leaf/90"
                disabled={act.isPending}
                onClick={() => act.mutate("approve")}
              >
                اعتماد
              </Button>
              <Button variant="outline" className="text-alert" onClick={() => setReject(true)}>
                إعادة للتعديل
              </Button>
            </>
          )
        }
      />
      {insp.rejection_reason && insp.status === "مرفوضة" && (
        <p className="rounded-xl bg-alert/10 p-3 text-sm">سبب الإعادة: {insp.rejection_reason}</p>
      )}
      {answers.length === 0 ? (
        <Empty>لم تُرسل هذه الجولة بعد.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Panel>
              <div className="text-xs text-muted-foreground">نسبة الامتثال</div>
              <div className="text-2xl font-bold text-national tabular-nums">
                {n(Number(insp.compliance_percent ?? 0), 1)}٪
              </div>
            </Panel>
            <Panel>
              <div className="text-xs text-muted-foreground">غير مطابق</div>
              <div className="text-2xl font-bold text-alert tabular-nums">{n(bad.length)}</div>
            </Panel>
            <Panel>
              <div className="text-xs text-muted-foreground">التقرير في اليوم نفسه</div>
              <div className="text-2xl font-bold text-national">
                {insp.report_same_day ? "نعم" : "لا"}
              </div>
            </Panel>
          </div>
          <Panel title="الملاحظات غير المطابقة">
            {bad.length === 0 ? (
              <Empty>كل البنود مطابقة أو لا تنطبق.</Empty>
            ) : (
              <div className="space-y-3">
                {bad.map((it) => {
                  const a = byItem.get(it.item_id)!;
                  return (
                    <div
                      key={it.item_id}
                      className="space-y-2 rounded-xl border border-alert/40 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill sev={a.severity ?? it.default_severity} />
                        <b className="text-sm">
                          {it.code} · {it.text}
                        </b>
                      </div>
                      {(a.floor_or_area || a.note) && (
                        <p className="text-sm text-muted-foreground">
                          {[a.floor_or_area, a.note].filter(Boolean).join(" — ")}
                        </p>
                      )}
                      <PhotoStrip paths={a.photo_paths} />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel title="كل البنود">
            <div className="divide-y text-sm">
              {items.map((it) => {
                const r = byItem.get(it.item_id)?.result;
                return (
                  <div key={it.item_id} className="flex items-center gap-2 py-2">
                    <span className="w-8 text-xs text-muted-foreground">{it.code}</span>
                    <span className="flex-1">{it.text}</span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        r === "مطابق"
                          ? "text-leaf"
                          : r === "غير مطابق"
                            ? "text-alert"
                            : "text-muted-foreground",
                      )}
                    >
                      {r ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}
      <ConfirmDialog
        open={reject}
        onOpenChange={setReject}
        title="إعادة الجولة للتعديل"
        description="تعود الجولة للمفتش مع السبب، ولا تُحتسب لها نقاط حتى تُعتمد."
        danger
        confirmLabel="إعادة"
        confirmDisabled={!reason.trim()}
        busy={act.isPending}
        onConfirm={() => act.mutate("reject")}
      >
        <Field label="السبب">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
