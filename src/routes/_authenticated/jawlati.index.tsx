import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Building2,
  CheckCheck,
  CheckSquare,
  ClipboardCheck,
  Eye,
  Flame,
  Footprints,
  Lock,
  Megaphone,
  RefreshCw,
  Settings2,
  Star,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { monthStart, riyadhDate, riyadhToday, useFmt } from "@/lib/format";
import { DueText, Empty, ListSkeleton, PageTitle, Panel, Pill, Ring, Stat } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jawlati/")({
  head: () => ({ meta: [{ title: "جولتي | آمن" }] }),
  component: Jawlati,
});

const badgeIcons: Record<string, typeof Award> = { Footprints, Eye, Flame, Building2, CheckCheck };
const badgeHow: Record<string, string> = {
  first_round: "أول جولة شهرية يعتمدها مديرك",
  safety_eye: "وثّق 10 ملاحظات مدعومة بالصور",
  streak_3: "3 أشهر متتالية بكل الجولات معتمدة وفي موعدها",
  building_no_delay: "كل جولات مبناك في موعدها خلال شهر",
  closer: "أغلق 10 إجراءات تصحيحية في موعدها",
};

function onTime(i: { status: string; submitted_at: string | null; due_date: string }) {
  return i.status === "معتمدة" && !!i.submitted_at && riyadhDate(i.submitted_at) <= i.due_date;
}

function streak(
  list: { status: string; submitted_at: string | null; due_date: string }[],
  today: string,
) {
  const by = new Map<string, { total: number; good: number }>();
  for (const i of list) {
    const m = i.due_date.slice(0, 7);
    const e = by.get(m) ?? { total: 0, good: 0 };
    e.total++;
    if (onTime(i)) e.good++;
    by.set(m, e);
  }
  let s = 0;
  const d = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  for (;;) {
    d.setUTCMonth(d.getUTCMonth() - 1);
    const e = by.get(d.toISOString().slice(0, 7));
    if (!e || e.good !== e.total) break;
    s++;
  }
  return s;
}

function Jawlati() {
  const { data: me } = useMe();
  const { n, date, month } = useFmt();
  const qc = useQueryClient();
  const today = riyadhToday();
  const q = useQuery({
    enabled: !!me,
    queryKey: ["jawlati-home", me?.id],
    queryFn: async () => {
      const [insp, pts, badges, mine, corrective] = await Promise.all([
        supabase
          .from("inspections")
          .select(
            "*, buildings!inspections_building_id_fkey(code, name), inspection_templates!inspections_template_id_fkey(name)",
          )
          .eq("assignee_id", me!.id)
          .order("due_date", { ascending: false }),
        supabase
          .from("points_ledger")
          .select("points, reason, created_at")
          .eq("user_id", me!.id)
          .order("created_at", { ascending: false }),
        supabase.from("badges").select("*"),
        supabase.from("user_badges").select("badge_id, awarded_at").eq("user_id", me!.id),
        supabase
          .from("tasks")
          .select("id, title, due_date, status")
          .eq("owner_id", me!.id)
          .not("finding_id", "is", null)
          .not("status", "in", '("مكتملة","ملغاة")')
          .order("due_date"),
      ]);
      return {
        insp: insp.data ?? [],
        pts: pts.data ?? [],
        badges: badges.data ?? [],
        mine: mine.data ?? [],
        corrective: corrective.data ?? [],
      };
    },
  });
  const gen = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_inspections", {});
      if (error) throw error;
      return data;
    },
    onSuccess: (c) => {
      toast.success(c ? `أُنشئت ${c} جولة لهذا الشهر` : "جولات هذا الشهر موجودة مسبقاً");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!me || q.isLoading) return <ListSkeleton rows={5} />;
  const d = q.data!;
  const thisMonth = d.insp.filter((i) => i.due_date.slice(0, 7) === today.slice(0, 7));
  const doneThisMonth = thisMonth.filter(
    (i) => i.status === "معتمدة" || i.status === "بانتظار الاعتماد",
  ).length;
  const upcoming = d.insp
    .filter((i) => ["لم تبدأ", "قيد التنفيذ", "مرفوضة"].includes(i.status))
    .reverse();
  const history = d.insp
    .filter((i) => !["لم تبدأ", "قيد التنفيذ", "مرفوضة"].includes(i.status))
    .slice(0, 6);
  const total = d.pts.reduce((s, p) => s + p.points, 0);
  const monthPts = d.pts
    .filter((p) => p.created_at.slice(0, 10) >= monthStart(today))
    .reduce((s, p) => s + p.points, 0);
  const st = streak(
    d.insp.filter((i) => i.due_date < monthStart(today)),
    today,
  );
  const earned = new Set(d.mine.map((b) => b.badge_id));

  return (
    <div className="space-y-5">
      <PageTitle
        title="جولتي"
        sub="جولة تفتيش شهرية لكل مبنى: الحريق، والإخلاء، والكهرباء، والإنشاءات، والصحة، والأمن، والموظفون"
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/jawlati/report">
                <Megaphone className="h-4 w-4" /> إبلاغ عن ملاحظة
              </Link>
            </Button>
            {me.isStaff && (
              <Button asChild variant="outline">
                <Link to="/jawlati/approvals">
                  <CheckSquare className="h-4 w-4" /> الاعتمادات
                </Link>
              </Button>
            )}
            {me.isStaff && (
              <Button asChild variant="outline">
                <Link to="/jawlati/setup">
                  <Settings2 className="h-4 w-4" /> المباني والجولات
                </Link>
              </Button>
            )}
            {me.isStaff && (
              <Button variant="outline" disabled={gen.isPending} onClick={() => gen.mutate()}>
                <RefreshCw className="h-4 w-4" /> توليد جولات الشهر
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Panel className="flex items-center justify-center">
          <Ring value={doneThisMonth} total={thisMonth.length} label={`جولات ${month(today)}`} />
        </Panel>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="نقاط هذا الشهر" value={n(monthPts)} tone="bg-mint/60" />
          <Stat label="مجموع النقاط" value={n(total)} />
          <Stat
            label="أشهر متتالية في الموعد"
            value={
              <span className="inline-flex items-center gap-1">
                {n(st)} <Flame className="h-5 w-5 text-alert" />
              </span>
            }
          />
          <p className="col-span-3 text-xs text-muted-foreground">
            النقاط تُحتسب عند اعتماد المدير فقط: 10 للجولة في موعدها، و5 لرفع التقرير في اليوم نفسه،
            و3 لتوثيق ملاحظة بالصور، و5 لإغلاق إجراء تصحيحي في موعده. نقاطك لا يراها إلا أنت ومديرك.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="جولاتي القادمة">
          {upcoming.length === 0 ? (
            <Empty>لا توجد جولة مفتوحة لك. تُنشأ جولات كل شهر تلقائياً في بدايته.</Empty>
          ) : (
            <div className="space-y-2">
              {upcoming.map((i) => (
                <Link
                  key={i.id}
                  to="/jawlati/inspection/$id"
                  params={{ id: i.id }}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-water/30"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-national text-xs font-bold text-mint">
                    {i.buildings?.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{i.inspection_templates?.name}</div>
                    <DueText due={i.due_date} />
                  </div>
                  {i.status === "مرفوضة" ? (
                    <Pill tone="مرفوضة">أُعيدت</Pill>
                  ) : (
                    <Button size="sm" className="pointer-events-none">
                      <ClipboardCheck className="h-4 w-4" />{" "}
                      {i.status === "قيد التنفيذ" ? "متابعة" : "ابدأ"}
                    </Button>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="إجراءاتي التصحيحية"
          action={
            <Link to="/jawlati/findings" className="text-sm font-medium text-leaf">
              سجل الملاحظات
            </Link>
          }
        >
          {d.corrective.length === 0 ? (
            <Empty>لا توجد إجراءات تصحيحية مسندة إليك.</Empty>
          ) : (
            <div className="space-y-2">
              {d.corrective.map((t) => (
                <Link
                  key={t.id}
                  to="/tasks/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-3 rounded-xl border p-3 text-sm hover:bg-water/30"
                >
                  <span className="min-w-0 flex-1 font-medium">{t.title}</span>
                  <DueText due={t.due_date} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="شاراتي"
        action={
          <Link
            to="/jawlati/board"
            className="inline-flex items-center gap-1 text-sm font-medium text-leaf"
          >
            <Trophy className="h-4 w-4" /> لوحة المباني
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {d.badges.map((b) => {
            const Icon = badgeIcons[b.icon] ?? Award;
            const has = earned.has(b.id);
            return (
              <div
                key={b.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center",
                  has ? "bg-mint/50" : "bg-white opacity-70",
                )}
              >
                <div
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full",
                    has ? "bg-national text-mint" : "bg-water text-muted-foreground",
                  )}
                >
                  {has ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </div>
                <div className="text-sm font-bold text-national">{b.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {has ? b.description : (badgeHow[b.code] ?? b.description)}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="آخر جولاتي">
          {history.length === 0 ? (
            <Empty>ستظهر هنا جولاتك المرسلة والمعتمدة.</Empty>
          ) : (
            <div className="space-y-2">
              {history.map((i) => (
                <Link
                  key={i.id}
                  to="/jawlati/inspection/$id"
                  params={{ id: i.id }}
                  className="flex items-center gap-3 rounded-xl border p-3 text-sm hover:bg-water/30"
                >
                  <b className="w-14 text-national">{i.buildings?.code}</b>
                  <span className="flex-1">{month(i.due_date)}</span>
                  {i.compliance_percent != null && (
                    <span className="tabular-nums">{n(Number(i.compliance_percent), 1)}٪</span>
                  )}
                  <Pill tone={i.status} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="سجل النقاط">
          {d.pts.length === 0 ? (
            <Empty>تظهر النقاط بعد اعتماد أول جولة لك.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {d.pts.slice(0, 8).map((p, k) => (
                <li key={k} className="flex items-center justify-between py-2">
                  <span>{p.reason}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {date(p.created_at.slice(0, 10))}
                    <b className="inline-flex items-center gap-1 text-base text-national">
                      <Star className="h-4 w-4 text-leaf" />
                      {n(p.points)}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
