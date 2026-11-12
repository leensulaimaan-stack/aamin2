import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { useFmt } from "@/lib/format";
import { SEVERITIES } from "@/lib/constants";
import { Field, inputCls, PageTitle, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "الإعدادات | آمن" }] }),
  component: Settings,
});

type Rules = {
  days_before: number[];
  due_day_reminder: boolean;
  overdue_repeat_days: number;
  escalate_after_days: number;
  severity_days: Record<string, number>;
};

function Settings() {
  const { data: me } = useMe();
  const { arabicDigits, setArabicDigits } = useFmt();
  const qc = useQueryClient();
  const prefs = useQuery({
    enabled: !!me,
    queryKey: ["prefs", me?.id],
    queryFn: async () =>
      (
        await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", me!.id)
          .maybeSingle()
      ).data,
  });
  const savePref = useMutation({
    mutationFn: async (email_enabled: boolean) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: me!.id, email_enabled });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["prefs"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="الإعدادات" />
      <Panel title="حسابي">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">الاسم</dt>
            <dd className="font-medium">{me?.profile?.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">البريد</dt>
            <dd className="font-medium" dir="ltr">
              {me?.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">الفريق</dt>
            <dd className="font-medium">{me?.profile?.teams?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">الدور</dt>
            <dd className="font-medium">
              {me?.isAdmin ? "مدير الإدارة" : me?.isManager ? "مدير فريق" : "موظف"}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="العرض والتنبيهات">
        <div className="space-y-3">
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            الأرقام العربية الهندية (١٢٣) بدل (123)
            <Switch checked={arabicDigits} onCheckedChange={setArabicDigits} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>
              نسخة من التنبيهات بالبريد الإلكتروني
              <span className="block text-xs text-muted-foreground">
                التنبيهات داخل التطبيق تعمل دائماً. إرسال البريد يبدأ بعد أن يربط مدير النظام خدمة
                بريد؛ تفضيلك محفوظ لذلك الحين.
              </span>
            </span>
            <Switch
              checked={prefs.data?.email_enabled ?? true}
              onCheckedChange={(c) => savePref.mutate(c)}
            />
          </label>
        </div>
      </Panel>
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> تثبيت التطبيق على الجوال
          </span>
        }
      >
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-water/50 p-3">
            <b>iPhone (Safari)</b>
            <ol className="mt-1 list-decimal space-y-1 ps-5">
              <li>افتح التطبيق في Safari.</li>
              <li>اضغط زر المشاركة.</li>
              <li>اختر «إضافة إلى الشاشة الرئيسية».</li>
            </ol>
          </div>
          <div className="rounded-xl bg-water/50 p-3">
            <b>Android (Chrome)</b>
            <ol className="mt-1 list-decimal space-y-1 ps-5">
              <li>افتح التطبيق في Chrome.</li>
              <li>اضغط قائمة النقاط الثلاث.</li>
              <li>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>
            </ol>
          </div>
        </div>
      </Panel>
      {me?.isAdmin && <AdminRules />}
    </div>
  );
}

function AdminRules() {
  const qc = useQueryClient();
  const { n } = useFmt();
  const q = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () =>
      (await supabase.from("app_settings").select("settings").eq("id", 1).maybeSingle()).data
        ?.settings as Rules | undefined,
  });
  const [v, setV] = useState<Rules | null>(null);
  useEffect(() => {
    if (q.data && !v) setV(q.data);
  }, [q.data, v]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_settings")
        .update({ settings: { ...(q.data ?? {}), ...v } })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("حُفظت قواعد التنبيه");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_notifications_now");
      if (error) throw error;
      return data;
    },
    onSuccess: (c) => {
      toast.success(
        `اكتمل التشغيل: ${c ?? 0} تنبيه جديد. التشغيل مرة ثانية اليوم لا يكرر التنبيهات.`,
      );
      qc.invalidateQueries({ queryKey: ["unread"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!v) return null;
  return (
    <Panel title="قواعد التنبيه (مدير الإدارة)">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="التذكير قبل الموعد (أيام عمل، مفصولة بفاصلة)">
          <input
            className={inputCls}
            dir="ltr"
            value={v.days_before.join(",")}
            onChange={(e) =>
              setV({
                ...v,
                days_before: e.target.value
                  .split(/[,،\s]+/)
                  .map(Number)
                  .filter((x) => x > 0),
              })
            }
          />
        </Field>
        <label className="flex min-h-11 items-center justify-between gap-3 self-end text-sm">
          تذكير صباح يوم الاستحقاق
          <Switch
            checked={v.due_day_reminder}
            onCheckedChange={(c) => setV({ ...v, due_day_reminder: c })}
          />
        </label>
        <Field label="تكرار تنبيه التأخر كل (أيام عمل)">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={v.overdue_repeat_days}
            onChange={(e) => setV({ ...v, overdue_repeat_days: Number(e.target.value) })}
          />
        </Field>
        <Field label="التصعيد للمدير بعد (أيام عمل من التأخر)">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={v.escalate_after_days}
            onChange={(e) => setV({ ...v, escalate_after_days: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-sm font-medium">مهلة الإجراء التصحيحي حسب الخطورة (أيام عمل)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEVERITIES.map((s) => (
            <Field key={s} label={s}>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={v.severity_days[s] ?? ""}
                onChange={(e) =>
                  setV({ ...v, severity_days: { ...v.severity_days, [s]: Number(e.target.value) } })
                }
              />
            </Field>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        هذه القيم اقتراحات أولية. يعمل التشغيل اليومي الساعة 7:00 صباحاً من الأحد إلى الخميس إذا
        كانت الجدولة مفعّلة في قاعدة البيانات، ويُنشئ أيضاً جولات الشهر الجديد. الإعداد الحالي: قبل
        الموعد {v.days_before.map((x) => n(x)).join(" و")} أيام.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          حفظ القواعد
        </Button>
        <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
          <Play className="h-4 w-4" /> تشغيل التنبيهات الآن (اختبار)
        </Button>
      </div>
    </Panel>
  );
}
