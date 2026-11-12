import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/kit";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `تسجيل الدخول | ${APP_NAME}` },
      {
        name: "description",
        content: "الدخول إلى نظام آمن لمتابعة مهام الصحة والسلامة والأمن والبيئة.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/home", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (error) throw error;
        toast.success("إذا كان البريد مسجلاً فسيصلك رابط لتعيين كلمة مرور جديدة.");
        setMode("in");
      }
    } catch {
      toast.error(
        mode === "in" ? "البريد أو كلمة المرور غير صحيحة." : "تعذّر الإرسال، حاول لاحقاً.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center page-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6">
          {/* horizontal logo: left-aligned per the NHC brand guide */}
          <div dir="ltr">
            <img
              src="/brand/nhc-logo-green.png"
              alt="NHC"
              className="h-10 w-20 object-contain object-left"
            />
          </div>
          <div>
            <h1 className="text-3xl">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{APP_SUBTITLE}</p>
          </div>
          <Field label="البريد الإلكتروني">
            <input
              type="email"
              dir="ltr"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </Field>
          {mode === "in" && (
            <Field label="كلمة المرور">
              <input
                type="password"
                dir="ltr"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          <Button className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "in" ? "دخول" : "إرسال رابط تعيين كلمة المرور"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "forgot" : "in")}
            className="w-full text-sm font-medium text-leaf"
          >
            {mode === "in" ? "نسيت كلمة المرور؟" : "العودة لتسجيل الدخول"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            الحسابات تُنشأ بدعوة من مدير الإدارة.
          </p>
        </form>
        <div className="mt-4 rounded-xl bg-arfaj p-3 text-xs text-ink">
          <div className="font-medium">حسابات تجريبية (كلمة المرور: Jawlati@2026)</div>
          <div dir="ltr" className="mt-1 space-y-0.5 text-start">
            <div>admin@jawlati.demo — مدير الإدارة</div>
            <div>manager@jawlati.demo — مدير فريق</div>
            <div>sara@jawlati.demo — موظفة</div>
          </div>
        </div>
        <p
          dir="ltr"
          className="mt-3 text-center text-[10px] tracking-wide text-muted-foreground/60"
        >
          By:Leen.BinSalloum
        </p>
      </div>
    </div>
  );
}
