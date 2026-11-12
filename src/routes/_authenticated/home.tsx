import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardCheck,
  Flame,
  Megaphone,
  Plus,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { addDays, monthStart, riyadhToday, useFmt } from "@/lib/format";
import { isOpen, useMyTasks, useTeamTasks } from "@/lib/data";
import {
  Bar,
  DueText,
  Empty,
  ListSkeleton,
  PageTitle,
  Panel,
  Pill,
  SeverityPill,
  Stat,
} from "@/components/kit";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "الرئيسية | آمن" }] }),
  component: HomePage,
});

function HomePage() {
  const { data: me } = useMe();
  const { n, date } = useFmt();
  const navigate = useNavigate();
  const today = riyadhToday();
  const tasks = useMyTasks(me?.id);

  const inspections = useQuery({
    enabled: !!me,
    queryKey: ["inspections", "mine", me?.id],
    queryFn: async () =>
      (
        await supabase
          .from("inspections")
          .select(
            "*, buildings!inspections_building_id_fkey(code, name), inspection_templates!inspections_template_id_fkey(name)",
          )
          .eq("assignee_id", me!.id)
          .order("due_date")
      ).data ?? [],
  });
  const points = useQuery({
    enabled: !!me,
    queryKey: ["points", me?.id],
    queryFn: async () =>
      (await supabase.from("points_ledger").select("points, created_at").eq("user_id", me!.id))
        .data ?? [],
  });
  const notifs = useQuery({
    enabled: !!me,
    queryKey: ["notifications", "latest", me?.id],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", me!.id)
          .order("created_at", { ascending: false })
          .limit(3)
      ).data ?? [],
  });

  const all = tasks.data ?? [];
  const open = all.filter((t) => isOpen(t.status) && t.owner_id === me?.id);
  const overdue = open.filter((t) => t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const corrective = open.filter((t) => t.finding_id);
  const nextInspection = (inspections.data ?? []).find((i) =>
    ["لم تبدأ", "قيد التنفيذ", "مرفوضة"].includes(i.status),
  );
  const monthPts = (points.data ?? [])
    .filter((p) => p.created_at.slice(0, 10) >= monthStart(today))
    .reduce((s, p) => s + p.points, 0);

  // week strip: Sunday → Saturday of the current week
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  const weekStart = addDays(today, -dow);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayNames = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  return (
    <div className="space-y-5">
      <PageTitle title={`أهلاً ${me?.profile?.full_name?.split(" ")[0] ?? ""}`} sub={date(today)} />

      {me?.isStaff && <ManagerSummary teamId={me.isAdmin ? null : me.teamId} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="يحتاج انتباهك">
          {tasks.isLoading ? (
            <ListSkeleton rows={2} />
          ) : overdue.length + dueToday.length === 0 ? (
            <Empty>لا توجد مهام متأخرة أو مستحقة اليوم.</Empty>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="متأخرة"
                  value={n(overdue.length)}
                  tone={overdue.length ? "bg-alert/10" : "bg-card"}
                  onClick={() => navigate({ to: "/tasks", search: { tab: "now" } })}
                />
                <Stat
                  label="مستحقة اليوم"
                  value={n(dueToday.length)}
                  tone={dueToday.length ? "bg-arfaj" : "bg-card"}
                  onClick={() => navigate({ to: "/tasks", search: { tab: "now" } })}
                />
              </div>
              <div className="space-y-2">
                {[...overdue, ...dueToday].slice(0, 4).map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="جولتك القادمة" className="bg-national text-white [&_h2]:text-mint">
          {nextInspection ? (
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-mint">{nextInspection.buildings?.code}</div>
                <div className="text-sm text-white/85">{nextInspection.buildings?.name}</div>
                <div className="mt-1 text-xs text-white/75">
                  {nextInspection.inspection_templates?.name}
                </div>
              </div>
              <div className="text-sm">موعدها: {date(nextInspection.due_date)}</div>
              {nextInspection.status === "مرفوضة" && <Pill tone="مرفوضة">أُعيدت للتعديل</Pill>}
              <Button asChild size="lg" className="w-full bg-mint text-national hover:bg-mint/90">
                <Link to="/jawlati/inspection/$id" params={{ id: nextInspection.id }}>
                  <ClipboardCheck className="h-5 w-5" /> ابدأ الجولة
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-white/85">
              لا توجد جولة مسندة إليك حالياً. تُنشأ جولات الشهر تلقائياً في بدايته.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction to="/jawlati" icon={ClipboardCheck} label="ابدأ جولة" />
        <QuickAction to="/tasks/new" icon={Plus} label="مهمة جديدة" />
        <QuickAction to="/jawlati/report" icon={Megaphone} label="إبلاغ عن ملاحظة" />
      </div>

      <Panel title="أسبوعي">
        <div className="grid grid-cols-7 gap-1">
          {week.map((d, i) => {
            const items = open.filter((t) => t.due_date === d);
            return (
              <Link
                key={d}
                to="/tasks"
                search={{ tab: d <= today ? "now" : "week" }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 text-xs",
                  d === today ? "bg-national text-white" : "hover:bg-water",
                  (i === 5 || i === 6) && d !== today && "text-muted-foreground",
                )}
              >
                <span>{dayNames[i]}</span>
                <span className="text-base font-bold tabular-nums">{n(Number(d.slice(8)))}</span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    items.length
                      ? d < today
                        ? "bg-alert"
                        : d === today
                          ? "bg-mint"
                          : "bg-leaf"
                      : "bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="إجراءات تصحيحية مسندة إليك"
          action={
            <Link to="/jawlati/findings" className="text-sm font-medium text-leaf">
              كل الملاحظات
            </Link>
          }
        >
          {corrective.length === 0 ? (
            <Empty>لا توجد إجراءات تصحيحية مفتوحة لك.</Empty>
          ) : (
            <div className="space-y-2">
              {corrective.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  to="/tasks/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-water/40"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-alert" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                  {t.priority !== "عادية" && (
                    <SeverityPill sev={t.priority === "عاجلة" ? "حرجة" : "عالية"} />
                  )}
                  <DueText due={t.due_date} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="جولتي هذا الشهر">
          <Link to="/jawlati" className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-mint text-national">
              <Star className="h-7 w-7" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-national">
                {n(monthPts)} نقطة
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-alert" /> اعرض نقاطك وشاراتك
              </div>
            </div>
          </Link>
        </Panel>
      </div>

      <Panel
        title="آخر التنبيهات"
        action={
          <Link to="/notifications" className="text-sm font-medium text-leaf">
            الكل
          </Link>
        }
      >
        {(notifs.data ?? []).length === 0 ? (
          <Empty>ستظهر هنا التذكيرات والتنبيهات المتعلقة بمهامك.</Empty>
        ) : (
          <ul className="divide-y">
            {(notifs.data ?? []).map((x) => (
              <li key={x.id}>
                <a href={x.link ?? "/notifications"} className="flex items-start gap-3 py-2.5">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      x.read_at ? "bg-water" : "bg-leaf",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{x.title}</span>
                    {x.body && (
                      <span className="block truncate text-xs text-muted-foreground">{x.body}</span>
                    )}
                  </span>
                  <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-3 text-center text-sm font-medium text-national transition-shadow hover:shadow-md"
    >
      <Icon className="h-6 w-6 text-leaf" />
      {label}
    </Link>
  );
}

function ManagerSummary({ teamId }: { teamId: string | null }) {
  const { n } = useFmt();
  const navigate = useNavigate();
  const today = riyadhToday();
  const team = useTeamTasks(true, teamId);
  const extra = useQuery({
    queryKey: ["mgr-summary", teamId],
    queryFn: async () => {
      const [findings, pending, board] = await Promise.all([
        supabase.from("findings").select("severity, status").neq("status", "مغلقة"),
        supabase
          .from("inspections")
          .select("id", { count: "exact", head: true })
          .eq("status", "بانتظار الاعتماد"),
        supabase.rpc("building_board", { p_month: today }),
      ]);
      return {
        findings: findings.data ?? [],
        pending: pending.count ?? 0,
        board: board.data ?? [],
      };
    },
  });
  const tasks = (team.data ?? []).filter((t) => !t.inspection_id);
  const month = tasks.filter(
    (t) =>
      t.status === "مكتملة" &&
      t.completed_at &&
      t.completed_at.slice(0, 7) === today.slice(0, 7) &&
      !t.logged_after_due,
  );
  const onTime = month.filter((t) => t.completed_at!.slice(0, 10) <= t.due_date).length;
  const rate = month.length ? Math.round((100 * onTime) / month.length) : 0;
  const overdue = tasks.filter((t) => isOpen(t.status) && t.due_date < today).length;
  const stuck = tasks.filter((t) => isOpen(t.status) && t.final_class === "عالقة").length;
  const crit = (extra.data?.findings ?? []).filter((f) => f.severity === "حرجة").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          label="الإنجاز في الموعد هذا الشهر"
          value={`${n(rate)}٪`}
          hint={`${n(onTime)} من ${n(month.length)}`}
          onClick={() => navigate({ to: "/dashboard" })}
        />
        <Stat
          label="متأخرة الآن"
          value={n(overdue)}
          tone={overdue ? "bg-alert/10" : "bg-card"}
          onClick={() => navigate({ to: "/tasks/team", search: { overdue: true } })}
        />
        <Stat
          label="ملاحظات حرجة مفتوحة"
          value={n(crit)}
          hint={`من ${n(extra.data?.findings.length ?? 0)} مفتوحة`}
          tone={crit ? "bg-alert/10" : "bg-card"}
          onClick={() => navigate({ to: "/jawlati/findings" })}
        />
        <Stat
          label="جولات بانتظار الاعتماد"
          value={n(extra.data?.pending ?? 0)}
          tone={extra.data?.pending ? "bg-arfaj" : "bg-card"}
          onClick={() => navigate({ to: "/jawlati/approvals" })}
        />
        <Stat
          label="مهام عالقة"
          value={n(stuck)}
          hint="للقرار في اجتماع الأسبوع"
          onClick={() => navigate({ to: "/decisions" })}
        />
      </div>
      <Panel
        title="امتثال المباني هذا الشهر"
        action={
          <Link to="/jawlati/board" className="text-sm font-medium text-leaf">
            لوحة المباني
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(extra.data?.board ?? []).map((b) => (
            <div key={b.building_id} className="space-y-1.5 rounded-xl bg-water/50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-national">{b.code}</span>
                <span className="text-sm tabular-nums">
                  {b.compliance == null ? "—" : `${n(b.compliance, 1)}٪`}
                </span>
              </div>
              <Bar pct={Number(b.compliance ?? 0)} />
              <div className="text-[11px] text-muted-foreground">
                {n(b.open_total)} ملاحظة مفتوحة
                {b.open_critical ? ` · ${n(b.open_critical)} حرجة` : ""}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
