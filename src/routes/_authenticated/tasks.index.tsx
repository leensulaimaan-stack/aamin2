import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { addDays, riyadhToday } from "@/lib/format";
import { isOpen, useMyTasks } from "@/lib/data";
import { Empty, ListSkeleton, PageTitle, Segmented } from "@/components/kit";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";

type Tab = "now" | "week" | "later" | "done";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "مهامي | آمن" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({
    tab: ["now", "week", "later", "done"].includes(s["tab"] as string)
      ? (s["tab"] as Tab)
      : undefined,
  }),
  component: MyTasks,
});

function MyTasks() {
  const { data: me } = useMe();
  const { tab = "now" } = Route.useSearch();
  const navigate = useNavigate({ from: "/tasks/" });
  const qc = useQueryClient();
  const tasks = useMyTasks(me?.id);
  const today = riyadhToday();
  const weekEnd = addDays(today, 7);
  const all = tasks.data ?? [];
  const open = all.filter((t) => isOpen(t.status));
  const groups: Record<Tab, typeof all> = {
    now: open.filter((t) => t.due_date <= today),
    week: open.filter((t) => t.due_date > today && t.due_date <= weekEnd),
    later: open.filter((t) => t.due_date > weekEnd),
    done: all.filter((t) => !isOpen(t.status)).reverse(),
  };

  const start = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").update({ status: "قيد التنفيذ" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("بدأت المهمة");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = groups[tab];
  return (
    <div>
      <PageTitle
        title="مهامي"
        sub="المهام المسندة إليك أو التي تشارك فيها"
        action={
          <Button asChild>
            <Link to="/tasks/new">
              <Plus className="h-4 w-4" /> مهمة جديدة
            </Link>
          </Button>
        }
      />
      <Segmented
        value={tab}
        onChange={(v) => navigate({ search: { tab: v }, replace: true })}
        options={[
          { value: "now", label: "المتأخرة واليوم", count: groups.now.length },
          { value: "week", label: "هذا الأسبوع", count: groups.week.length },
          { value: "later", label: "لاحقاً", count: groups.later.length },
          { value: "done", label: "المكتملة" },
        ]}
      />
      <div className="mt-4 space-y-2">
        {tasks.isLoading ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <Empty
            action={
              tab !== "done" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/tasks/new">أضف مهمة</Link>
                </Button>
              )
            }
          >
            {tab === "now"
              ? "لا توجد مهام متأخرة أو مستحقة اليوم."
              : tab === "done"
                ? "ستظهر هنا المهام المكتملة والملغاة."
                : "لا توجد مهام في هذه الفترة."}
          </Empty>
        ) : (
          list.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              actions={
                t.status === "لم تبدأ" && t.owner_id === me?.id && !t.inspection_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="hidden sm:inline-flex"
                    disabled={start.isPending}
                    onClick={() => start.mutate(t.id)}
                  >
                    بدء
                  </Button>
                ) : null
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
