import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useUnreadCount } from "@/lib/data";
import { useFmt } from "@/lib/format";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { mainNav, moreNav, visible } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function isActive(path: string, to: string) {
  if (to === "/tasks") return path === "/tasks" || /^\/tasks\/(?!team)/.test(path);
  if (to === "/jawlati")
    return (
      path === "/jawlati" ||
      path.startsWith("/jawlati/inspection") ||
      path.startsWith("/jawlati/report")
    );
  return path === to || path.startsWith(to + "/");
}

function Layout() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { arabicDigits, setArabicDigits } = useFmt();
  const unread = useUnreadCount(me?.id);
  const more = visible(moreNav, me);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isLoading && me && !me.isMember) {
    return (
      <div className="grid min-h-screen place-items-center page-bg px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center">
          <img src="/brand/nhc-logo-green.png" alt="NHC" className="mx-auto mb-5 h-10 w-auto" />
          <h1 className="text-xl">حسابك بانتظار التفعيل</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّلت الدخول بنجاح، لكن مدير الإدارة لم يحدد دورك وفريقك بعد. تواصل معه ليفعّل حسابك من
            صفحة «المستخدمون».
          </p>
          <Button variant="outline" className="mt-5" onClick={signOut}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-30 bg-national text-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-4">
          <Link to="/home" className="flex min-w-0 flex-col leading-tight">
            <span className="text-xl font-bold text-mint">{APP_NAME}</span>
            <span className="hidden truncate text-[11px] text-white/80 sm:block">
              {APP_SUBTITLE}
            </span>
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <button
              onClick={() => setArabicDigits(!arabicDigits)}
              className="hidden h-10 rounded-lg px-2 text-xs text-mint hover:bg-white/10 sm:block"
              title="تبديل شكل الأرقام"
            >
              {arabicDigits ? "١٢٣" : "123"}
            </button>
            <Link
              to="/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-lg text-mint hover:bg-white/10"
              aria-label="التنبيهات"
            >
              <Bell className="h-5 w-5" />
              {!!unread.data && (
                <span className="absolute end-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-alert px-1 text-[10px] font-bold text-white tabular-nums">
                  {unread.data > 99 ? "99+" : unread.data}
                </span>
              )}
            </Link>
            <Link
              to="/settings"
              className="hidden items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10 md:flex"
              title="الإعدادات"
            >
              <Avatar name={me?.profile?.full_name} />
              <span className="max-w-[10rem] truncate text-sm text-mint">
                {me?.profile?.full_name}
              </span>
            </Link>
            <button
              onClick={signOut}
              className="grid h-10 w-10 place-items-center rounded-lg text-mint hover:bg-white/10"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
            {/* NHC brand guide: the horizontal logo is always left-aligned */}
            <img
              src="/brand/nhc-logo-white.png"
              alt="NHC"
              className="ms-2 h-10 w-20 object-contain"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-60 shrink-0 overflow-y-auto py-6 lg:block">
          <nav className="space-y-1" aria-label="التنقل الرئيسي">
            {[...mainNav, ...more].map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-national transition-colors hover:bg-white",
                  isActive(path, i.to) && "bg-national text-white hover:bg-national",
                )}
              >
                <i.icon className="h-4 w-4 shrink-0" />
                {i.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 py-6">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="التنقل السفلي"
      >
        {mainNav.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              isActive(path, i.to) && "text-leaf",
            )}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
        <Link
          to="/more"
          className={cn(
            "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
            (path === "/more" || more.some((m) => isActive(path, m.to))) && "text-leaf",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          المزيد
        </Link>
      </nav>
    </div>
  );
}
