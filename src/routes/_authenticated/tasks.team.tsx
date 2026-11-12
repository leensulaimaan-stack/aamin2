import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { useMe } from "@/lib/auth";
import { riyadhToday, useFmt } from "@/lib/format";
import { isOpen, useNames, useProfiles, useTeamTasks, useTeams } from "@/lib/data";
import { CLASSES, TASK_STATUSES } from "@/lib/constants";
import { exportXlsx, taskExportRows } from "@/lib/export";
import { Empty, inputCls, ListSkeleton, NativeSelect, PageTitle } from "@/components/kit";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";

type S = {
  overdue?: boolean | undefined;
  cls?: string | undefined;
  owner?: string | undefined;
  status?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/tasks/team")({
  head: () => ({ meta: [{ title: "مهام الفريق | آمن" }] }),
  validateSearch: (s: Record<string, unknown>): S => ({
    overdue: s["overdue"] === true || s["overdue"] === "true" ? true : undefined,
    cls: typeof s["cls"] === "string" ? (s["cls"] as string) : undefined,
    owner: typeof s["owner"] === "string" ? (s["owner"] as string) : undefined,
    status: typeof s["status"] === "string" ? (s["status"] as string) : undefined,
  }),
  component: TeamTasks,
});

const PAGE = 25;

function TeamTasks() {
  const { data: me } = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tasks/team" });
  const teams = useTeams();
  const [team, setTeam] = useState<string>("");
  const teamId = me?.isAdmin ? team || null : me?.teamId;
  const tasks = useTeamTasks(!!me?.isStaff, teamId);
  const profiles = useProfiles();
  const name = useNames();
  const { n } = useFmt();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const today = riyadhToday();
  const set = (patch: Partial<S>) => {
    setPage(1);
    navigate({ search: (p: S) => ({ ...p, ...patch }), replace: true });
  };

  const rows = useMemo(() => {
    return (tasks.data ?? []).filter((t) => {
      if (search.overdue && !(isOpen(t.status) && t.due_date < today)) return false;
      if (search.cls && t.final_class !== search.cls) return false;
      if (search.owner && t.owner_id !== search.owner) return false;
      if (search.status && t.status !== search.status) return false;
      if (from && t.due_date < from) return false;
      if (to && t.due_date > to) return false;
      if (q && !t.title.includes(q.trim())) return false;
      return true;
    });
  }, [tasks.data, search, q, from, to, today]);

  if (me && !me.isStaff) return <Empty>هذه الصفحة لمديري الفرق.</Empty>;

  return (
    <div>
      <PageTitle
        title="مهام الفريق"
        sub={`${n(rows.length)} مهمة`}
        action={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportXlsx("مهام-الفريق", "المهام", taskExportRows(rows, name, teams.data ?? []))
              }
              disabled={!rows.length}
            >
              <Download className="h-4 w-4" /> تصدير Excel
            </Button>
            <Button asChild>
              <Link to="/tasks/new">
                <Plus className="h-4 w-4" /> مهمة جديدة
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            aria-label="بحث بالعنوان"
            placeholder="ابحث بعنوان المهمة"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputCls + " ps-9"}
          />
        </div>
        {me?.isAdmin && (
          <NativeSelect
            ariaLabel="الفريق"
            value={team}
            onChange={(v) => {
              setTeam(v);
              setPage(1);
            }}
          >
            <option value="">كل الفريقين</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          ariaLabel="المسؤول"
          value={search.owner ?? ""}
          onChange={(v) => set({ owner: v || undefined })}
        >
          <option value="">كل المسؤولين</option>
          {(profiles.data ?? [])
            .filter((p) => !teamId || p.team_id === teamId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          ariaLabel="الحالة"
          value={search.status ?? ""}
          onChange={(v) => set({ status: v || undefined })}
        >
          <option value="">كل الحالات</option>
          {TASK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          ariaLabel="التصنيف"
          value={search.cls ?? ""}
          onChange={(v) => set({ cls: v || undefined })}
        >
          <option value="">كل التصنيفات</option>
          {CLASSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          من{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          إلى{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--leaf)]"
            checked={!!search.overdue}
            onChange={(e) => set({ overdue: e.target.checked || undefined })}
          />
          المتأخرة فقط
        </label>
      </div>
      <div className="space-y-2">
        {tasks.isLoading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <Empty>لا توجد مهام تطابق هذا البحث.</Empty>
        ) : (
          rows
            .slice(0, page * PAGE)
            .map((t) => <TaskRow key={t.id} t={t} showOwner owner={name(t.owner_id)} />)
        )}
      </div>
      {rows.length > page * PAGE && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setPage(page + 1)}>
            عرض المزيد
          </Button>
        </div>
      )}
    </div>
  );
}
