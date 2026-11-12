import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  Paperclip,
  Play,
  Send,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { errMsg, signedPhotoUrls, uploadPhotos, useMe } from "@/lib/auth";
import { riyadhDate, riyadhToday, useFmt } from "@/lib/format";
import { isOpen, useNames } from "@/lib/data";
import { CLASS_HINT, CLASSES, DELAY_REASONS } from "@/lib/constants";
import {
  Avatar,
  ClassChip,
  ConfirmDialog,
  DueText,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  PhotoPicker,
  PhotoStrip,
  Pill,
  SeverityPill,
} from "@/components/kit";
import { TaskForm, type TaskFormValue } from "@/components/task-form";
import { StepsPanel, DependenciesPanel, SimplifyDialog } from "@/components/complex-parts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: () => ({ meta: [{ title: "تفاصيل المهمة | آمن" }] }),
  component: TaskDetail,
});

type TaskPatch = Database["public"]["Tables"]["tasks"]["Update"];

const fieldLabel: Record<string, string> = {
  status: "الحالة",
  due_date: "تاريخ الاستحقاق",
  owner: "المسؤول",
  class: "التصنيف",
  cancel_reason: "سبب الإلغاء",
  created: "أنشأ المهمة",
};

function TaskDetail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const name = useNames();
  const { date, n } = useFmt();
  const today = riyadhToday();

  const task = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "*, projects!tasks_project_id_fkey(id, title), annual_goals!tasks_goal_id_fkey(id, title), teams!tasks_team_id_fkey(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const extra = useQuery({
    queryKey: ["task-extra", id],
    queryFn: async () => {
      const [contrib, comments, attachments, audit, deps] = await Promise.all([
        supabase.from("task_contributors").select("user_id").eq("task_id", id),
        supabase.from("task_comments").select("*").eq("task_id", id).order("created_at"),
        supabase.from("task_attachments").select("*").eq("task_id", id).order("created_at"),
        supabase
          .from("audit_log")
          .select("*")
          .eq("entity_type", "task")
          .eq("entity_id", id)
          .order("changed_at", { ascending: false }),
        supabase.from("external_dependencies").select("id, status").eq("task_id", id),
      ]);
      return {
        contributors: (contrib.data ?? []).map((c) => c.user_id),
        comments: comments.data ?? [],
        attachments: attachments.data ?? [],
        audit: audit.data ?? [],
        deps: deps.data ?? [],
      };
    },
  });
  const finding = useQuery({
    enabled: !!task.data?.finding_id,
    queryKey: ["finding", task.data?.finding_id],
    queryFn: async () =>
      (
        await supabase
          .from("findings")
          .select(
            "*, buildings!findings_building_id_fkey(code, name), checklist_items!findings_item_id_fkey(text)",
          )
          .eq("id", task.data!.finding_id!)
          .maybeSingle()
      ).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["task", id] });
    qc.invalidateQueries({ queryKey: ["task-extra", id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["finding"] });
  };

  const update = useMutation({
    mutationFn: async (patch: TaskPatch) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const [doneOpen, setDoneOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [simplifyOpen, setSimplifyOpen] = useState(false);
  const [delay, setDelay] = useState({ reason: "", note: "" });
  const [cancelReason, setCancelReason] = useState("");

  const t = task.data;
  if (task.isLoading) return <ListSkeleton rows={5} />;
  if (!t)
    return (
      <Empty
        action={
          <Button asChild variant="outline">
            <Link to="/tasks">العودة إلى مهامي</Link>
          </Button>
        }
      >
        لم نجد هذه المهمة، أو ليست لديك صلاحية عرضها.
      </Empty>
    );

  const isOwner = t.owner_id === me?.id;
  const isContributor = (extra.data?.contributors ?? []).includes(me?.id ?? "");
  const canManage = !!me?.isStaff && (me.isAdmin || me.teamId === t.team_id);
  const canAct = isOwner || isContributor || canManage;
  const open = isOpen(t.status);
  const late = open && t.due_date < today;
  const special = !!t.inspection_id || !!t.finding_id;
  const hasOpenDep = (extra.data?.deps ?? []).some((d) => d.status === "مطلوب");

  function complete() {
    if (late && !delay.reason) {
      setDoneOpen(true);
      return;
    }
    update.mutate({
      status: "مكتملة",
      delay_reason: delay.reason || null,
      delay_note: delay.note || null,
    });
    setDoneOpen(false);
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => history.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-leaf"
      >
        <ArrowRight className="h-4 w-4" /> رجوع
      </button>
      <PageTitle
        title={t.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={t.status} />
            <ClassChip cls={t.final_class} />
            {t.priority !== "عادية" && (
              <Pill tone={t.priority === "عاجلة" ? "overdue" : "soon"}>أولوية {t.priority}</Pill>
            )}
            {t.logged_after_due && <Pill tone="later">سُجّلت بعد الموعد</Pill>}
            <span>{t.teams?.name}</span>
          </span>
        }
      />

      {/* context links */}
      <div className="flex flex-wrap gap-2">
        {t.projects && (
          <ContextLink
            to="/projects/$id"
            id={t.projects.id}
            icon={FolderKanban}
            label={`مشروع: ${t.projects.title}`}
          />
        )}
        {t.annual_goals && (
          <ContextLink
            to="/goals/$id"
            id={t.annual_goals.id}
            icon={Target}
            label={`الهدف: ${t.annual_goals.title}`}
          />
        )}
        {t.inspection_id && (
          <ContextLink
            to="/jawlati/inspection/$id"
            id={t.inspection_id}
            icon={ClipboardCheck}
            label="فتح الجولة"
          />
        )}
      </div>

      {/* actions */}
      {canAct && open && !t.inspection_id && (
        <Panel className="flex flex-wrap items-center gap-2">
          {t.status === "لم تبدأ" && !t.finding_id && (
            <Button
              onClick={() => update.mutate({ status: "قيد التنفيذ" })}
              disabled={update.isPending}
            >
              <Play className="h-4 w-4" /> بدء التنفيذ
            </Button>
          )}
          {!t.finding_id && (
            <Button
              onClick={complete}
              disabled={update.isPending}
              className="bg-leaf hover:bg-leaf/90"
            >
              <CheckCircle2 className="h-4 w-4" /> إنجاز
            </Button>
          )}
          {t.status !== "بانتظار جهة خارجية" && hasOpenDep && (
            <Button
              variant="outline"
              onClick={() => update.mutate({ status: "بانتظار جهة خارجية" })}
            >
              بانتظار جهة خارجية
            </Button>
          )}
          {t.status === "بانتظار جهة خارجية" && (
            <Button variant="outline" onClick={() => update.mutate({ status: "قيد التنفيذ" })}>
              إعادة إلى قيد التنفيذ
            </Button>
          )}
          {t.final_class === "طويلة" && (isOwner || canManage) && !t.project_id && !special && (
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/projects/new", search: { from: t.id } })}
            >
              <FolderKanban className="h-4 w-4" /> تحويل إلى مشروع
            </Button>
          )}
          {t.final_class === "معقدة" && canManage && (
            <Button variant="outline" onClick={() => setSimplifyOpen(true)}>
              تبسيط المهمة
            </Button>
          )}
          {canManage && !special && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              تعديل
            </Button>
          )}
          {canManage && !special && (
            <Button variant="ghost" className="text-alert" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" /> إلغاء المهمة
            </Button>
          )}
        </Panel>
      )}

      {t.finding_id && finding.data && (
        <FindingPanel
          f={finding.data}
          task={t}
          canClose={(isOwner || canManage) && open}
          onDone={refresh}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="التفاصيل">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Info label="المسؤول">
              <span className="flex items-center gap-2">
                <Avatar name={name(t.owner_id)} className="h-6 w-6 text-[10px]" />
                {name(t.owner_id)}
              </span>
            </Info>
            <Info label="تاريخ الاستحقاق">
              <DueText due={t.due_date} done={!open} />
            </Info>
            <Info label="تاريخ البدء">{date(t.start_date)}</Info>
            <Info label="تاريخ الإنجاز">
              {t.completed_at ? date(riyadhDate(t.completed_at)) : "—"}
            </Info>
            {(extra.data?.contributors ?? []).length > 0 && (
              <Info label="المشاركون">{extra.data!.contributors.map(name).join("، ")}</Info>
            )}
            {t.delay_reason && (
              <Info label="سبب التأخر">
                {t.delay_reason}
                {t.delay_note ? ` — ${t.delay_note}` : ""}
              </Info>
            )}
            {t.cancel_reason && <Info label="سبب الإلغاء">{t.cancel_reason}</Info>}
          </dl>
          {t.description && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-water/50 p-3 text-sm">
              {t.description}
            </p>
          )}
        </Panel>
        <Panel title="التصنيف">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ClassChip cls={t.final_class} />
              {t.class_overridden_by && (
                <span className="text-xs text-muted-foreground">
                  (عدّله المدير؛ المقترح: {t.suggested_class})
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{CLASS_HINT[t.final_class ?? ""]}</p>
            {canManage && (
              <Field label="تعديل التصنيف">
                <NativeSelect
                  value={t.final_class ?? ""}
                  onChange={(v) =>
                    update.mutate(
                      v === t.suggested_class
                        ? { final_class: v, class_overridden_by: null, class_overridden_at: null }
                        : {
                            final_class: v,
                            class_overridden_by: me!.id,
                            class_overridden_at: new Date().toISOString(),
                          },
                    )
                  }
                >
                  {CLASSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>
        </Panel>
      </div>

      <Tabs defaultValue={t.final_class === "معقدة" ? "steps" : "comments"} dir="rtl">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-water/70 p-1">
          <TabsTrigger value="steps">الخطوات</TabsTrigger>
          <TabsTrigger value="deps">الجهات الخارجية</TabsTrigger>
          <TabsTrigger value="comments">
            التعليقات ({n(extra.data?.comments.length ?? 0)})
          </TabsTrigger>
          <TabsTrigger value="files">
            المرفقات ({n(extra.data?.attachments.length ?? 0)})
          </TabsTrigger>
          <TabsTrigger value="audit">السجل</TabsTrigger>
        </TabsList>
        <TabsContent value="steps">
          <StepsPanel taskId={id} canEdit={canAct && open} />
        </TabsContent>
        <TabsContent value="deps">
          <DependenciesPanel taskId={id} canEdit={canAct && open} onChange={refresh} />
        </TabsContent>
        <TabsContent value="comments">
          <Comments
            taskId={id}
            items={extra.data?.comments ?? []}
            onAdded={refresh}
            canAdd={canAct}
          />
        </TabsContent>
        <TabsContent value="files">
          <Attachments
            taskId={id}
            items={extra.data?.attachments ?? []}
            onAdded={refresh}
            canAdd={canAct}
          />
        </TabsContent>
        <TabsContent value="audit">
          <Panel>
            {(extra.data?.audit ?? []).length === 0 ? (
              <Empty>لا توجد تغييرات مسجلة.</Empty>
            ) : (
              <ul className="space-y-3">
                {extra.data!.audit.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf" />
                    <span>
                      <b>{a.changed_by ? name(a.changed_by) : "النظام"}</b>{" "}
                      {a.field === "created" ? (
                        "أنشأ المهمة"
                      ) : (
                        <>
                          غيّر {fieldLabel[a.field] ?? a.field} من «
                          {fmtVal(a.field, a.old_value, date)}» إلى «
                          {fmtVal(a.field, a.new_value, date)}»
                        </>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(a.changed_at).toLocaleString("ar-SA-u-nu-latn", {
                          timeZone: "Asia/Riyadh",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        title="المهمة متأخرة عن موعدها"
        description="اختر سبب التأخر قبل الإنجاز. يساعد ذلك في تحليل أسباب التأخير."
        confirmLabel="إنجاز المهمة"
        confirmDisabled={!delay.reason || (delay.reason === "أخرى" && !delay.note.trim())}
        busy={update.isPending}
        onConfirm={complete}
      >
        <div className="space-y-3">
          <Field label="سبب التأخر">
            <NativeSelect
              value={delay.reason}
              onChange={(v) => setDelay((d) => ({ ...d, reason: v }))}
            >
              <option value="">اختر السبب</option>
              {DELAY_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={delay.reason === "أخرى" ? "التوضيح (مطلوب)" : "ملاحظة (اختياري)"}>
            <Textarea
              value={delay.note}
              onChange={(e) => setDelay((d) => ({ ...d, note: e.target.value }))}
              rows={2}
            />
          </Field>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="إلغاء المهمة"
        description="لا تُحذف المهمة، بل تبقى في السجل بحالة «ملغاة»."
        confirmLabel="إلغاء المهمة"
        danger
        confirmDisabled={!cancelReason.trim()}
        busy={update.isPending}
        onConfirm={() => {
          update.mutate({ status: "ملغاة", cancel_reason: cancelReason.trim() });
          setCancelOpen(false);
        }}
      >
        <Field label="سبب الإلغاء">
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
          />
        </Field>
      </ConfirmDialog>

      {editOpen && me && (
        <ConfirmDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="تعديل المهمة"
          hideFooter
          onConfirm={() => setEditOpen(false)}
        >
          <TaskForm
            me={me}
            initial={{
              title: t.title,
              description: t.description ?? "",
              team_id: t.team_id,
              owner_id: t.owner_id,
              contributors: extra.data?.contributors ?? [],
              start_date: t.start_date ?? "",
              due_date: t.due_date,
              priority: t.priority,
              goal_id: t.goal_id ?? "",
            }}
            submitLabel="حفظ التعديلات"
            busy={update.isPending}
            onSubmit={async (v: TaskFormValue) => {
              await update.mutateAsync({
                title: v.title.trim(),
                description: v.description.trim() || null,
                owner_id: v.owner_id,
                start_date: v.start_date || null,
                due_date: v.due_date,
                priority: v.priority,
                goal_id: v.goal_id || null,
              });
              const before = new Set(extra.data?.contributors ?? []);
              const after = new Set(v.contributors);
              const add = [...after].filter((x) => !before.has(x));
              const rem = [...before].filter((x) => !after.has(x));
              if (add.length)
                await supabase
                  .from("task_contributors")
                  .insert(add.map((user_id) => ({ task_id: id, user_id })));
              for (const r of rem)
                await supabase
                  .from("task_contributors")
                  .delete()
                  .eq("task_id", id)
                  .eq("user_id", r);
              refresh();
              setEditOpen(false);
            }}
          />
        </ConfirmDialog>
      )}
      {simplifyOpen && (
        <SimplifyDialog
          task={t}
          contributors={extra.data?.contributors ?? []}
          open={simplifyOpen}
          onOpenChange={setSimplifyOpen}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function fmtVal(field: string, v: string | null, date: (d: string) => string) {
  if (!v) return "—";
  return field === "due_date" ? date(v) : v;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

function ContextLink({
  to,
  id,
  icon: Icon,
  label,
}: {
  to: "/projects/$id" | "/goals/$id" | "/jawlati/inspection/$id";
  id: string;
  icon: typeof Target;
  label: string;
}) {
  return (
    <Link
      to={to}
      params={{ id }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mint/70 px-3 text-sm font-medium text-national"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Comments({
  taskId,
  items,
  onAdded,
  canAdd,
}: {
  taskId: string;
  items: { id: string; author_id: string; body: string; created_at: string }[];
  onAdded: () => void;
  canAdd: boolean;
}) {
  const name = useNames();
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      onAdded();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Panel>
      <div className="space-y-3">
        {items.length === 0 && <Empty>لا توجد تعليقات بعد.</Empty>}
        {items.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={name(c.author_id)} />
            <div className="min-w-0 flex-1 rounded-xl bg-water/50 p-3 text-sm">
              <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <b className="text-ink">{name(c.author_id)}</b>
                {new Date(c.created_at).toLocaleString("ar-SA-u-nu-latn", {
                  timeZone: "Asia/Riyadh",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
        {canAdd && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) add.mutate();
            }}
          >
            <input
              aria-label="تعليق جديد"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب تعليقاً"
              className={inputCls}
            />
            <Button disabled={!body.trim() || add.isPending} aria-label="إرسال التعليق">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </Panel>
  );
}

function Attachments({
  taskId,
  items,
  onAdded,
  canAdd,
}: {
  taskId: string;
  items: { id: string; name: string; path: string }[];
  onAdded: () => void;
  canAdd: boolean;
}) {
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  async function onFiles(files: FileList | null) {
    if (!files?.length || !me) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`الملف «${f.name}» أكبر من 10MB.`);
        const path = (await uploadPhotos(me.id, `tasks/${taskId}`, [f]))[0]!;
        const { error } = await supabase
          .from("task_attachments")
          .insert({ task_id: taskId, path, name: f.name });
        if (error) throw error;
      }
      onAdded();
      toast.success("أُضيفت المرفقات");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function open(path: string) {
    const [url] = await signedPhotoUrls([path]);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("تعذّر فتح الملف");
  }
  return (
    <Panel>
      <div className="space-y-2">
        {items.length === 0 && <Empty>لا توجد مرفقات.</Empty>}
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => open(a.path)}
            className="flex w-full items-center gap-2 rounded-xl border p-3 text-start text-sm hover:bg-water/40"
          >
            <Paperclip className="h-4 w-4 text-leaf" /> {a.name}
          </button>
        ))}
        {canAdd && (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-leaf px-4 text-sm font-medium text-leaf hover:bg-mint/30">
            <Paperclip className="h-4 w-4" /> {busy ? "جارٍ الرفع…" : "إضافة مرفق"}
            <input
              type="file"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        )}
      </div>
    </Panel>
  );
}

type FindingRow = {
  id: string;
  severity: string;
  status: string;
  floor_or_area: string | null;
  description: string | null;
  photo_paths: string[];
  closure_note: string | null;
  closure_photo_paths: string[];
  verify_rejection: string | null;
  buildings: { code: string; name: string } | null;
  checklist_items: { text: string } | null;
};

function FindingPanel({
  f,
  task,
  canClose,
  onDone,
}: {
  f: FindingRow;
  task: { id: string; due_date: string };
  canClose: boolean;
  onDone: () => void;
}) {
  const { data: me } = useMe();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [delay, setDelay] = useState({ reason: "", note: "" });
  const late = riyadhToday() > task.due_date;
  const close = useMutation({
    mutationFn: async () => {
      const paths = await uploadPhotos(me!.id, `findings/${f.id}`, files);
      const { error } = await supabase.rpc("close_finding", {
        p_id: f.id,
        p_note: note.trim(),
        p_photos: paths,
        ...(delay.reason ? { p_delay_reason: delay.reason } : {}),
        ...(delay.note ? { p_delay_note: delay.note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُرسل الإغلاق للتحقق");
      setFiles([]);
      setNote("");
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-alert" /> الملاحظة المرتبطة
        </span>
      }
      action={<SeverityPill sev={f.severity} />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Building2 className="h-4 w-4 text-leaf" />
            {f.buildings?.code} — {f.buildings?.name}
            {f.floor_or_area ? ` · ${f.floor_or_area}` : ""}
          </div>
          {f.checklist_items?.text && <div className="font-medium">{f.checklist_items.text}</div>}
          {f.description && <p className="text-muted-foreground">{f.description}</p>}
          <div className="text-xs text-muted-foreground">قبل المعالجة</div>
          <PhotoStrip paths={f.photo_paths} />
          <Pill tone={f.status} />
        </div>
        <div className="space-y-3">
          {f.closure_photo_paths.length > 0 && (
            <div className="space-y-2 text-sm">
              <div className="text-xs text-muted-foreground">بعد المعالجة</div>
              <PhotoStrip paths={f.closure_photo_paths} />
              {f.closure_note && <p>{f.closure_note}</p>}
            </div>
          )}
          {f.verify_rejection && f.status === "قيد المعالجة" && (
            <div className="rounded-xl bg-alert/10 p-3 text-sm">
              أُعيدت للمعالجة: {f.verify_rejection}
            </div>
          )}
          {canClose && (f.status === "مفتوحة" || f.status === "قيد المعالجة") && (
            <div className="space-y-3 rounded-xl border border-dashed border-leaf p-3">
              <div className="text-sm font-bold text-national">إغلاق الإجراء التصحيحي</div>
              <PhotoPicker files={files} onChange={setFiles} label="صورة بعد المعالجة" />
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="ما الذي تم لمعالجة الملاحظة؟"
                aria-label="وصف المعالجة"
              />
              {late && (
                <NativeSelect
                  ariaLabel="سبب التأخر"
                  value={delay.reason}
                  onChange={(v) => setDelay((d) => ({ ...d, reason: v }))}
                >
                  <option value="">سبب التأخر (مطلوب لأن الموعد فات)</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </NativeSelect>
              )}
              <Button
                disabled={
                  close.isPending || !files.length || !note.trim() || (late && !delay.reason)
                }
                onClick={() => close.mutate()}
              >
                إرسال للتحقق
              </Button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
