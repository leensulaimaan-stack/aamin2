import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Megaphone,
  Target,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { riyadhDate, riyadhToday } from "@/lib/format";
import { Empty, ListSkeleton, PageTitle, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "التنبيهات | آمن" }] }),
  component: Notifications,
});

const icons: Record<string, typeof Bell> = {
  before: Clock,
  due: Clock,
  overdue: AlertTriangle,
  escalation: AlertTriangle,
  critical: AlertTriangle,
  assigned: UserPlus,
  corrective: AlertTriangle,
  approval: ClipboardCheck,
  approved: CheckCheck,
  rejected: ClipboardCheck,
  report: Megaphone,
  goal: Target,
  digest: Bell,
};

function Notifications() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const today = riyadhToday();
  const q = useQuery({
    enabled: !!me,
    queryKey: ["notifications", me?.id],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", me!.id)
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const mark = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });
  const list = q.data ?? [];
  const unread = list.filter((x) => !x.read_at).map((x) => x.id);
  const groups = [
    { t: "اليوم", items: list.filter((x) => riyadhDate(x.created_at) === today) },
    { t: "سابقاً", items: list.filter((x) => riyadhDate(x.created_at) !== today) },
  ].filter((g) => g.items.length);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle
        title="التنبيهات"
        sub="تذكير قبل الموعد، ويوم الاستحقاق، وعند التأخر، وتنبيهات الجولات والملاحظات"
        action={
          unread.length > 0 && (
            <Button variant="outline" onClick={() => mark.mutate(unread)}>
              تعليم الكل كمقروء
            </Button>
          )
        }
      />
      {q.isLoading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <Empty>لا توجد تنبيهات بعد. تصلك هنا تذكيرات مهامك وجولاتك.</Empty>
      ) : (
        groups.map((g) => (
          <Panel key={g.t} title={g.t}>
            <ul className="divide-y">
              {g.items.map((x) => {
                const Icon = icons[x.type] ?? Bell;
                return (
                  <li key={x.id}>
                    <a
                      href={x.link ?? "#"}
                      onClick={() => !x.read_at && mark.mutate([x.id])}
                      className={cn("flex items-start gap-3 py-3", !x.read_at && "font-medium")}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                          ["overdue", "escalation", "critical", "corrective"].includes(x.type)
                            ? "bg-alert/15 text-alert"
                            : "bg-mint text-national",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{x.title}</span>
                        {x.body && (
                          <span className="block text-xs text-muted-foreground">{x.body}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {new Date(x.created_at).toLocaleString("ar-SA-u-nu-latn", {
                            timeZone: "Asia/Riyadh",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      {!x.read_at && (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-leaf"
                          aria-label="غير مقروء"
                        />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
