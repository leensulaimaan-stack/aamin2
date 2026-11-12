import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { addMonths, monthStart, riyadhDate, riyadhToday, useFmt } from "@/lib/format";
import { isOpen, useNames, useTeamTasks, useTeams } from "@/lib/data";
import { CLASSES, DELAY_REASONS } from "@/lib/constants";
import {
  Empty,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  Segmented,
  Stat,
} from "@/components/kit";
import { RecognitionPanel } from "@/components/recognition";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة الفريق | آمن" }] }),
  component: Dashboard,
});

const C = {
  leaf: "#009C6D",
  teal: "#14A0B3",
  blue: "#5578D8",
  purple: "#A484D8",
  alert: "#E17141",
  ink: "#1D1D1D",
  national: "#0B4332",
  grid: "#DCEEF8",
};
const SERIES = [C.leaf, C.teal, C.blue, C.purple, C.alert];

function Dashboard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { n, shortMonth } = useFmt();
  const name = useNames();
  const teams = useTeams();
  const today = riyadhToday();
  const [team, setTeam] = useState("");
  const [period, setPeriod] = useState<"month" | "q" | "year">("month");
  const teamId = me?.isAdmin ? team || null : me?.teamId;
  const tasksQ = useTeamTasks(!!me?.isStaff, teamId);
  const extra = useQuery({
    enabled: !!me?.isStaff,
    queryKey: ["dash-extra", teamId],
    queryFn: async () => {
      const [findings, pending, trend] = await Promise.all([
        supabase
          .from("findings")
          .select(
            "severity, status, building_id, checklist_items!findings_item_id_fkey(code), buildings!findings_building_id_fkey!inner(team_id)",
          ),
        supabase
          .from("inspections")
          .select("id, buildings!inspections_building_id_fkey!inner(team_id)")
          .eq("status", "بانتظار الاعتماد"),
        supabase.rpc("building_compliance_trend", { p_months: 6 }),
      ]);
      const f = (findings.data ?? []).filter((x) => !teamId || x.buildings?.team_id === teamId);
      const p = (pending.data ?? []).filter((x) => !teamId || x.buildings?.team_id === teamId);
      return { findings: f, pending: p.length, trend: trend.data ?? [] };
    },
  });

  const from =
    period === "month"
      ? monthStart(today)
      : period === "q"
        ? addMonths(today, -2)
        : today.slice(0, 4) + "-01-01";
  const tasks = (tasksQ.data ?? []).filter((t) => !t.inspection_id);
  const data = useMemo(() => {
    const done = (t: (typeof tasks)[number]) =>
      t.status === "مكتملة" && t.completed_at && !t.logged_after_due;
    const inPeriod = tasks.filter((t) => done(t) && riyadhDate(t.completed_at!) >= from);
    const onTime = inPeriod.filter((t) => riyadhDate(t.completed_at!) <= t.due_date);
    const months = Array.from({ length: 6 }, (_, i) => addMonths(today, i - 5));
    const monthly = months.map((m) => {
      const list = tasks.filter(
        (t) => done(t) && riyadhDate(t.completed_at!).slice(0, 7) === m.slice(0, 7),
      );
      const ok = list.filter((t) => riyadhDate(t.completed_at!) <= t.due_date).length;
      return {
        m,
        label: shortMonth(m),
        rate: list.length ? Math.round((100 * ok) / list.length) : null,
        total: list.length,
      };
    });
    const open = tasks.filter((t) => isOpen(t.status));
    const byClass = CLASSES.map((c) => ({
      c,
      count: open.filter((t) => t.final_class === c).length,
    }));
    const owners = new Map<string, number>();
    open.forEach((t) => owners.set(t.owner_id, (owners.get(t.owner_id) ?? 0) + 1));
    const workloadRaw = [...owners.entries()].sort((a, b) => b[1] - a[1]);
    const totalOpen = workloadRaw.reduce((s, [, c]) => s + c, 0);
    let cum = 0;
    const workload = workloadRaw.map(([id, count]) => {
      cum += count;
      return {
        id,
        name: name(id).split(" ").slice(0, 2).join(" "),
        count,
        cum: totalOpen ? Math.round((100 * cum) / totalOpen) : 0,
      };
    });
    const avg = workload.length ? totalOpen / workload.length : 0;
    const late = tasks.filter(
      (t) => t.delay_reason && t.completed_at && riyadhDate(t.completed_at) >= from,
    );
    const reasons = DELAY_REASONS.map((r) => ({
      r,
      count: late.filter((t) => t.delay_reason === r).length,
    })).filter((x) => x.count);
    return {
      rate: inPeriod.length ? Math.round((100 * onTime.length) / inPeriod.length) : 0,
      onTime: onTime.length,
      total: inPeriod.length,
      overdue: open.filter((t) => t.due_date < today).length,
      stuck: open.filter((t) => t.final_class === "عالقة").length,
      waiting: open.filter((t) => t.status === "بانتظار جهة خارجية").length,
      monthly,
      byClass,
      workload,
      avg,
      reasons,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQ.data, from, today]);

  const trend = useMemo(() => {
    const rows = extra.data?.trend ?? [];
    const codes = [...new Set(rows.map((r) => r.building_code))].sort();
    const months = [...new Set(rows.map((r) => r.month))].sort();
    return {
      codes,
      rows: months.map((m) => ({
        label: shortMonth(m),
        ...Object.fromEntries(
          codes.map((c) => [
            c,
            rows.find((r) => r.month === m && r.building_code === c)?.compliance ?? null,
          ]),
        ),
      })),
    };
  }, [extra.data, shortMonth]);
  const bySection = useMemo(() => {
    const f = extra.data?.findings ?? [];
    return "ABCDEFGHIJ"
      .split("")
      .map((s) => ({ s, count: f.filter((x) => x.checklist_items?.code?.startsWith(s)).length }));
  }, [extra.data]);
  const openF = (extra.data?.findings ?? []).filter((f) => f.status !== "مغلقة");

  if (me && !me.isStaff) return <Empty>هذه الصفحة لمديري الفرق.</Empty>;
  if (tasksQ.isLoading) return <ListSkeleton rows={6} />;

  const tick = { fill: C.ink, fontSize: 12 };
  return (
    <div className="space-y-4">
      <PageTitle
        title="لوحة الفريق"
        sub="المهام المسجلة بعد موعدها والمهام الملغاة لا تدخل في نسبة الإنجاز في الموعد"
        action={
          me?.isAdmin && (
            <NativeSelect ariaLabel="الفريق" value={team} onChange={setTeam} className="w-44">
              <option value="">كل الفريقين</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )
        }
      />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: "month", label: "هذا الشهر" },
          { value: "q", label: "آخر 3 أشهر" },
          { value: "year", label: "هذه السنة" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="الإنجاز في الموعد"
          value={`${n(data.rate)}٪`}
          hint={`${n(data.onTime)} من ${n(data.total)}`}
        />
        <Stat
          label="المتأخرة الآن"
          value={n(data.overdue)}
          tone={data.overdue ? "bg-alert/10" : "bg-card"}
          onClick={() => navigate({ to: "/tasks/team", search: { overdue: true } })}
        />
        <Stat
          label="العالقة"
          value={n(data.stuck)}
          onClick={() => navigate({ to: "/decisions" })}
        />
        <Stat
          label="بانتظار جهات خارجية"
          value={n(data.waiting)}
          onClick={() => navigate({ to: "/complex" })}
        />
        <Stat
          label="ملاحظات مفتوحة"
          value={n(openF.length)}
          hint={`${n(openF.filter((f) => f.severity === "حرجة").length)} حرجة`}
          onClick={() => navigate({ to: "/jawlati/findings" })}
        />
        <Stat
          label="جولات بانتظار الاعتماد"
          value={n(extra.data?.pending ?? 0)}
          onClick={() => navigate({ to: "/jawlati/approvals" })}
        />
      </div>
      <RecognitionPanel teamId={teamId} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="نسبة الإنجاز في الموعد — آخر 6 أشهر">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <LineChart data={data.monthly} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="label" tick={tick} reversed />
                <YAxis domain={[0, 100]} tick={tick} orientation="right" unit="%" width={44} />
                <Tooltip formatter={(v) => [`${v}%`, "في الموعد"]} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={C.leaf}
                  strokeWidth={3}
                  dot={{ r: 4, fill: C.leaf }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="المهام المفتوحة حسب التصنيف">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={data.byClass} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="c" tick={tick} reversed />
                <YAxis allowDecimals={false} tick={tick} orientation="right" width={32} />
                <Tooltip formatter={(v) => [v, "مهمة"]} />
                <RBar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(d: { c?: string }) =>
                    d?.c && navigate({ to: "/tasks/team", search: { cls: d.c } })
                  }
                >
                  {data.byClass.map((_, i) => (
                    <Cell key={i} fill={SERIES[i % SERIES.length]} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="توزيع العبء: المهام المفتوحة لكل موظف">
          {data.workload.length === 0 ? (
            <Empty>لا توجد مهام مفتوحة.</Empty>
          ) : (
            <>
              <div className="h-72" dir="ltr">
                <ResponsiveContainer>
                  <ComposedChart
                    data={data.workload}
                    margin={{ top: 10, right: 16, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ ...tick, fontSize: 11 }}
                      reversed
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis
                      yAxisId="c"
                      allowDecimals={false}
                      tick={tick}
                      orientation="right"
                      width={32}
                    />
                    <YAxis
                      yAxisId="p"
                      domain={[0, 100]}
                      tick={tick}
                      orientation="left"
                      unit="%"
                      width={44}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" />
                    <ReferenceLine
                      yAxisId="c"
                      y={data.avg}
                      stroke={C.national}
                      strokeDasharray="5 4"
                      label={{
                        value: `متوسط الفريق ${data.avg.toFixed(1)}`,
                        fill: C.national,
                        fontSize: 11,
                        position: "insideTopLeft",
                      }}
                    />
                    <RBar
                      yAxisId="c"
                      dataKey="count"
                      name="مهام مفتوحة"
                      fill={C.teal}
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(d: { id?: string }) =>
                        d?.id && navigate({ to: "/tasks/team", search: { owner: d.id } })
                      }
                    />
                    <Line
                      yAxisId="p"
                      dataKey="cum"
                      name="النسبة التراكمية"
                      stroke={C.alert}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">
                الأعمدة من الأكثر إلى الأقل، والخط يوضح كم يحمل أول عدد من الموظفين من مجموع العمل
                المفتوح.
              </p>
            </>
          )}
        </Panel>
        <Panel title="أسباب التأخر في الفترة">
          {data.reasons.length === 0 ? (
            <Empty>لا توجد مهام مكتملة متأخرة في هذه الفترة.</Empty>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer>
                <BarChart
                  data={data.reasons}
                  layout="vertical"
                  margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={tick} reversed />
                  <YAxis type="category" dataKey="r" tick={tick} orientation="right" width={170} />
                  <Tooltip formatter={(v) => [v, "مهمة"]} />
                  <RBar dataKey="count" fill={C.purple} radius={[6, 0, 0, 6]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="امتثال المباني شهرياً">
          {trend.rows.length === 0 ? (
            <Empty>تظهر بعد اعتماد أول جولات شهرية.</Empty>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer>
                <LineChart data={trend.rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="label" tick={tick} reversed />
                  <YAxis domain={[0, 100]} tick={tick} orientation="right" unit="%" width={44} />
                  <Tooltip />
                  <Legend />
                  {trend.codes.map((c, i) => (
                    <Line
                      key={c}
                      dataKey={c}
                      stroke={SERIES[i % SERIES.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="الملاحظات حسب قسم الفحص">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={bySection} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="s" tick={tick} reversed />
                <YAxis allowDecimals={false} tick={tick} orientation="right" width={32} />
                <Tooltip formatter={(v) => [v, "ملاحظة"]} />
                <RBar
                  dataKey="count"
                  fill={C.blue}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={() => navigate({ to: "/jawlati/findings" })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            A الحريق · B الإخلاء · C الكهرباء · D الإنشاءات · E الصحة · F الإسعافات · G الأمن · H
            الموظفون · I المواد الخطرة · J المواقف
          </p>
        </Panel>
      </div>
    </div>
  );
}
