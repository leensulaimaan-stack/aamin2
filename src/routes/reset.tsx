import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/kit";

export const Route = createFileRoute("/reset")({
  ssr: false,
  head: () => ({ meta: [{ title: `تعيين كلمة المرور | ${APP_NAME}` }] }),
  component: Reset,
});

/** Landing page for invitation and password-reset links. */
function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error("تعذّر الحفظ. اطلب رابطاً جديداً من صفحة الدخول.");
      return;
    }
    toast.success("حُفظت كلمة المرور");
    navigate({ to: "/home", replace: true });
  }
  return (
    <div className="grid min-h-screen place-items-center page-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6">
        <div dir="ltr">
          <img
            src="/brand/nhc-logo-green.png"
            alt="NHC"
            className="h-10 w-20 object-contain object-left"
          />
        </div>
        <h1 className="text-2xl">تعيين كلمة المرور</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            افتح هذه الصفحة من الرابط الذي وصلك بالبريد. إذا انتهت صلاحية الرابط، اطلب رابطاً جديداً
            من «نسيت كلمة المرور».
          </p>
        ) : (
          <>
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
              <input
                type="password"
                dir="ltr"
                required
                minLength={8}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="تأكيد كلمة المرور">
              <input
                type="password"
                dir="ltr"
                required
                minLength={8}
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Button className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ والدخول
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
