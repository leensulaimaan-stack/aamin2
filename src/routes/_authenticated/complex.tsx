import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, riyadhToday, useFmt } from "@/lib/format";
import { useNames } from "@/lib/data";
import { PARTY_TYPES } from "@/lib/constants";
import {
  Bar,
  Empty,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Pill,
  Stat,
} from "@/components/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/complex")({
  head: () => ({ meta: [{ title: "المهام المعقدة | آمن" }] }),
  component: ComplexTasks,
});

function ComplexTasks() {
  const name = useNames();
  const { n } = useFmt();
  const today = riyadhToday();
  const [owner, setOwner] = useState("");
  const [party, setParty] = useState("");
  const [minWait, setMinWait] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const q = useQuery({
    queryKey: ["complex"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, owner_id, status, due_date, task_steps!task_steps_task_id_fkey(is_done), external_dependencies!external_dependencies_task_id_fkey(id, party_type, party_name, what_is_needed, requested_on, expected_by, status)",
        )
        .eq("final_class", "معقدة")
        .not("status", "in", '("مكتملة","ملغاة")')
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });
  const rows = (q.data ?? []).map((t) => {
    const openDeps = t.external_dependencies.filter((d) => d.status === "مطلوب");
    const maxWait = Math.max(0, ...openDeps.map((d) => daysBetween(d.requested_on, today)));
    return { ...t, openDeps, maxWait, group: openDeps[0]?.party_type ?? "بدون جهة خارجية" };
  });
  const filtered = rows.filter(
    (r) =>
      (!owner || r.owner_id === owner) &&
      (!party || r.openDeps.some((d) => d.party_type === party)) &&
      (!minWait || r.maxWait > Number(minWait)),
  );
  const waiting = rows.filter((r) => r.openDeps.length);
  const allOpenDeps = rows.flatMap((r) => r.openDeps);
  const avgWait = allOpenDeps.length
    ? Math.round(
        allOpenDeps.reduce((s, d) => s + daysBetween(d.requested_on, today), 0) /
          allOpenDeps.length,
      )
    : 0;
  const groups = [...PARTY_TYPES, "بدون جهة خارجية"]
    .map((g) => ({ g, items: filtered.filter((r) => r.group === g) }))
    .filter((x) => x.items.length);

  return (
    <div>
      <PageTitle
        title="المهام المعقدة"
        sub="مسؤول واحد لكل مهمة، وما ينتظر جهات أخرى منفصل عن باقي العمل"
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="المهام المعقدة" value={n(rows.length)} />
        <Stat
          label="بانتظار جهة خارجية"
          value={n(waiting.length)}
          tone={waiting.length ? "bg-arfaj" : "bg-card"}
        />
        <Stat label="متوسط أيام الانتظار" value={n(avgWait)} />
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <NativeSelect ariaLabel="المسؤول" value={owner} onChange={setOwner}>
          <option value="">كل المسؤولين</option>
          {[...new Set(rows.map((r) => r.owner_id))].map((o) => (
            <option key={o} value={o}>
              {name(o)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect ariaLabel="نوع الجهة" value={party} onChange={setParty}>
          <option value="">كل الجهات</option>
          {PARTY_TYPES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          تنتظر أكثر من
          <input
            type="number"
            min={0}
            value={minWait}
            onChange={(e) => setMinWait(e.target.value)}
            className={inputCls + " w-20"}
            aria-label="عدد الأيام"
          />
          يوماً
        </label>
      </div>
      {q.isLoading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <Empty>
          لا توجد مهام معقدة مفتوحة. تُصنَّف المهمة «معقدة» تلقائياً إذا كان فيها مشاركون أو تنتظر
          جهة خارجية.
        </Empty>
      ) : (
        <div className="space-y-4">
          {groups.map(({ g, items }) => (
            <section key={g} className="rounded-2xl border bg-card">
              <button
                className="flex w-full items-center justify-between p-4"
                onClick={() => setCollapsed({ ...collapsed, [g]: !collapsed[g] })}
                aria-expanded={!collapsed[g]}
              >
                <h2 className="text-base">
                  {g}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({n(items.length)})
                  </span>
                </h2>
                <ChevronDown
                  className={cn("h-5 w-5 transition-transform", collapsed[g] && "-rotate-90")}
                />
              </button>
              {!collapsed[g] && (
                <div className="space-y-2 px-4 pb-4">
                  {items.map((t) => {
                    const done = t.task_steps.filter((s) => s.is_done).length;
                    return (
                      <Link
                        key={t.id}
                        to="/tasks/$id"
                        params={{ id: t.id }}
                        className="block space-y-2 rounded-xl border p-3 hover:bg-water/30"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{t.title}</span>
                          <Pill tone={t.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          المسؤول: {name(t.owner_id)}
                        </div>
                        {t.task_steps.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Bar pct={(100 * done) / t.task_steps.length} />
                            <span className="shrink-0 tabular-nums">
                              {n(done)} من {n(t.task_steps.length)}
                            </span>
                          </div>
                        )}
                        {t.openDeps.map((d) => {
                          const w = daysBetween(d.requested_on, today);
                          const past = d.expected_by && d.expected_by < today;
                          return (
                            <div
                              key={d.id}
                              className="flex flex-wrap items-center gap-2 rounded-lg bg-water/50 px-2.5 py-1.5 text-xs"
                            >
                              <Hourglass className="h-3.5 w-3.5 text-purple" />
                              <span className="flex-1">
                                {d.party_name}: {d.what_is_needed}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 font-bold tabular-nums",
                                  past ? "bg-alert text-white" : "bg-white text-ink",
                                )}
                              >
                                {n(w)} يوماً
                              </span>
                            </div>
                          );
                        })}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
