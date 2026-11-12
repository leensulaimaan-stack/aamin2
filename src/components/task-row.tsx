import { Link } from "@tanstack/react-router";
import { ChevronLeft, FolderKanban, Users } from "lucide-react";
import { ClassChip, DueText, Pill } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/data";
import { isOpen } from "@/lib/data";

type Row = Task & { projects?: { title: string } | null };

export function TaskRow({
  t,
  owner,
  showOwner,
  actions,
}: {
  t: Row;
  owner?: string;
  showOwner?: boolean;
  actions?: React.ReactNode;
}) {
  const open = isOpen(t.status);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm">
      <Link to="/tasks/$id" params={{ id: t.id }} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium text-ink", !open && "text-muted-foreground")}>
            {t.title}
          </span>
          <ClassChip cls={t.final_class} />
          {t.logged_after_due && <Pill tone="later">سُجّلت بعد الموعد</Pill>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DueText due={t.due_date} done={!open} />
          {t.projects?.title && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              {t.projects.title}
            </span>
          )}
          {showOwner && owner && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {owner}
            </span>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Pill tone={t.status} />
        <ChevronLeft className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </div>
    </div>
  );
}
