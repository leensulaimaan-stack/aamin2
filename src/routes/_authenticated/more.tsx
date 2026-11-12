import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMe } from "@/lib/auth";
import { moreNav, visible } from "@/lib/nav";
import { PageTitle } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "المزيد | آمن" }] }),
  component: More,
});

function More() {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle title="المزيد" />
      <nav className="divide-y overflow-hidden rounded-2xl border bg-card">
        {visible(moreNav, me).map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="flex min-h-14 items-center gap-3 px-4 text-sm font-medium text-national hover:bg-water/40"
          >
            <i.icon className="h-5 w-5 text-leaf" />
            <span className="flex-1">{i.label}</span>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </nav>
      <p dir="ltr" className="mt-6 text-center text-[10px] tracking-wide text-muted-foreground/60">
        By:Leen.BinSalloum
      </p>
    </div>
  );
}
