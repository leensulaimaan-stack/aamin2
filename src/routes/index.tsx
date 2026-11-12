import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BellRing, ClipboardCheck, FolderKanban, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} | ${APP_SUBTITLE}` },
      {
        name: "description",
        content:
          "نظام آمن لمتابعة مهام إدارة الصحة والسلامة والأمن والبيئة: تنبيهات، ومشاريع بمراحل، وأهداف سنوية، وجولات تفتيش شهرية.",
      },
      { property: "og:title", content: `${APP_NAME} | ${APP_SUBTITLE}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-national text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
        <div dir="ltr">
          <img
            src="/brand/nhc-logo-white.png"
            alt="NHC"
            className="h-12 w-24 object-contain object-left"
          />
        </div>
        <div className="my-auto py-16">
          <h1 className="text-5xl text-mint md:text-6xl">{APP_NAME}</h1>
          <p className="mt-3 text-lg text-white">{APP_SUBTITLE}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: BellRing, t: "تذكير قبل الموعد وتصعيد عند التأخر" },
              { icon: FolderKanban, t: "المهام الطويلة مشاريع بمراحل قصيرة" },
              { icon: Target, t: "الأهداف السنوية في متابعة مستقلة" },
              { icon: ClipboardCheck, t: "جولتي: تفتيش شهري للمباني بالنقاط والشارات" },
            ].map((f) => (
              <div
                key={f.t}
                className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm font-medium text-mint"
              >
                <f.icon className="h-5 w-5 shrink-0" /> {f.t}
              </div>
            ))}
          </div>
          <Button asChild size="lg" className="mt-10 bg-mint text-national hover:bg-mint/90">
            <Link to="/auth">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
