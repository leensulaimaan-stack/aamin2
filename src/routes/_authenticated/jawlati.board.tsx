import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Medal, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { addMonths, monthStart, riyadhToday, useFmt } from "@/lib/format";
import { useTeams } from "@/lib/data";
import {
  Bar,
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jawlati/board")({
  head: () => ({ meta: [{ title: "لوحة المباني | آمن" }] }),
  component: Board,
});

function Board() {
  const { data: me } = useMe();
  const { n, month, date } = useFmt();
  const today = riyadhToday();
  const [m, setM] = useState(monthStart(today));
  const [newCh, setNewCh] = useState(false);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(today, -i));
  const board = useQuery({
    queryKey: ["board", m],
    queryFn: async () => (await supabase.rpc("building_board", { p_month: m })).data ?? [],
  });
  const challenges = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .gte("end_date", today)
        .order("end_date");
      const out = [];
      for (const c of data ?? []) {
        const { data: p } = await supabase.rpc("challenge_progress2", { p_challenge: c.id });
        out.push({ ...c, progress: p?.[0] ?? { assigned: 0, on_time: 0, rate: 0 } });
      }
      return out;
    },
  });
  const rows = board.data ?? [];
  return (
    <div className="space-y-4">
      <PageTitle
        title="لوحة المباني"
        sub="ترتيب المباني لا الأشخاص: نسبة الجولات المعتمدة في موعدها، ثم متوسط الامتثال، ثم الأقل في الملاحظات الحرجة المفتوحة"
        action={
          <NativeSelect ariaLabel="الشهر" value={m} onChange={setM} className="w-44">
            {months.map((x) => (
              <option key={x} value={x}>
                {month(x)}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {board.isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <Empty>لا توجد مبانٍ بعد.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((b, i) => (
            <div
              key={b.building_id}
              className={cn(
                "grid grid-cols-[3rem_1fr] items-center gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[3rem_1fr_repeat(3,9rem)]",
                i === 0 && b.assigned > 0 && "border-leaf bg-mint/30",
              )}
            >
              <div
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full text-lg font-bold tabular-nums",
                  i === 0 && b.assigned > 0 ? "bg-national text-mint" : "bg-water text-national",
                )}
              >
                {i === 0 && b.assigned > 0 ? <Medal className="h-5 w-5" /> : n(i + 1)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-national">
                  {b.code}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{b.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.assigned
                    ? `${n(b.approved)} معتمدة من ${n(b.assigned)}`
                    : "لا توجد جولة في هذا الشهر"}
                </div>
              </div>
              <Metric
                label="في الموعد"
                value={`${n(Number(b.on_time_rate))}٪`}
                pct={Number(b.on_time_rate)}
              />
              <Metric
                label="الامتثال"
                value={b.compliance == null ? "—" : `${n(Number(b.compliance), 1)}٪`}
                pct={Number(b.compliance ?? 0)}
              />
              <div className="col-span-2 text-xs md:col-span-1">
                <div className="text-muted-foreground">ملاحظات مفتوحة</div>
                <div className="font-bold tabular-nums">
                  {n(b.open_total)}
                  {b.open_critical ? (
                    <span className="text-alert"> · {n(b.open_critical)} حرجة</span>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Panel
        title="التحديات الحالية"
        action={
          me?.isStaff && (
            <Button size="sm" variant="outline" onClick={() => setNewCh(true)}>
              <Plus className="h-4 w-4" /> تحدٍ جديد
            </Button>
          )
        }
      >
        {(challenges.data ?? []).length === 0 ? (
          <Empty>لا يوجد تحدٍ قائم. التحدي هدف مشترك للفريق، مثل: كل جولات الربع في موعدها.</Empty>
        ) : (
          <div className="space-y-4">
            {challenges.data!.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <b>{c.title}</b>
                  <span className="text-muted-foreground">
                    {date(c.start_date)} — {date(c.end_date)}
                  </span>
                </div>
                <Bar pct={Number(c.progress.rate)} target={c.target_percent} />
                <div className="text-xs text-muted-foreground">
                  {n(c.progress.on_time)} من {n(c.progress.assigned)} جولة في موعدها حتى الآن (
                  {n(Number(c.progress.rate))}٪) · المستهدف {n(c.target_percent)}٪
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {newCh && <ChallengeDialog open={newCh} onOpenChange={setNewCh} />}
    </div>
  );
}

function Metric({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <b className="tabular-nums">{value}</b>
      </div>
      <Bar pct={pct} />
    </div>
  );
}

function ChallengeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: me } = useMe();
  const teams = useTeams();
  const qc = useQueryClient();
  const today = riyadhToday();
  const [v, setV] = useState({
    title: "",
    team_id: me?.isAdmin ? "" : (me?.teamId ?? ""),
    start_date: today,
    end_date: addMonths(today, 3),
    target_percent: "100",
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("challenges").insert({
        title: v.title.trim(),
        team_id: v.team_id || null,
        start_date: v.start_date,
        end_date: v.end_date,
        target_percent: Number(v.target_percent),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُضيف التحدي");
      qc.invalidateQueries({ queryKey: ["challenges"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="تحدٍ جديد"
      confirmLabel="إضافة"
      busy={add.isPending}
      confirmDisabled={!v.title.trim() || (!me?.isAdmin && !v.team_id)}
      onConfirm={() => add.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان" className="sm:col-span-2">
          <input
            className={inputCls}
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            placeholder="كل جولات الربع في موعدها"
          />
        </Field>
        {me?.isAdmin && (
          <Field label="الفريق">
            <NativeSelect value={v.team_id} onChange={(x) => setV({ ...v, team_id: x })}>
              <option value="">كل الفريقين</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="المستهدف ٪">
          <input
            type="number"
            min={1}
            max={100}
            className={inputCls}
            value={v.target_percent}
            onChange={(e) => setV({ ...v, target_percent: e.target.value })}
          />
        </Field>
        <Field label="من">
          <input
            type="date"
            className={inputCls}
            value={v.start_date}
            onChange={(e) => setV({ ...v, start_date: e.target.value })}
          />
        </Field>
        <Field label="إلى">
          <input
            type="date"
            className={inputCls}
            value={v.end_date}
            onChange={(e) => setV({ ...v, end_date: e.target.value })}
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
