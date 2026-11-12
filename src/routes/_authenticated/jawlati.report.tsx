import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, uploadPhotos, useMe } from "@/lib/auth";
import { useBuildings } from "@/lib/data";
import { SEVERITIES } from "@/lib/constants";
import { Field, inputCls, NativeSelect, PageTitle, Panel, PhotoPicker } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jawlati/report")({
  head: () => ({ meta: [{ title: "إبلاغ عن ملاحظة | آمن" }] }),
  component: Report,
});

function Report() {
  const { data: me } = useMe();
  const buildings = useBuildings();
  const navigate = useNavigate();
  const [v, setV] = useState({ building: "", area: "", desc: "", sev: "متوسطة" });
  const [files, setFiles] = useState<File[]>([]);
  const send = useMutation({
    mutationFn: async () => {
      const paths = files.length ? await uploadPhotos(me!.id, "reports", files) : [];
      const { error } = await supabase.rpc("submit_report", {
        p_building: v.building,
        p_area: (v.area.trim() || null) as string,
        p_desc: v.desc.trim(),
        p_sev: v.sev,
        p_photos: paths,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("وصل بلاغك إلى مدير الفريق. شكراً لك.");
      navigate({ to: "/jawlati/findings" });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="إبلاغ عن ملاحظة سلامة"
        sub="رأيت خطراً في أحد المباني؟ أرسل صورة ووصفاً، ويقرر المدير تحويله إلى ملاحظة رسمية بإجراء تصحيحي."
      />
      <Panel>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المبنى">
              <NativeSelect
                required
                value={v.building}
                onChange={(x) => setV({ ...v, building: x })}
              >
                <option value="">اختر المبنى</option>
                {(buildings.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="الموقع (الطابق / المنطقة)">
              <input
                className={inputCls}
                value={v.area}
                onChange={(e) => setV({ ...v, area: e.target.value })}
              />
            </Field>
          </div>
          <Field label="وصف الملاحظة">
            <Textarea
              required
              rows={3}
              value={v.desc}
              onChange={(e) => setV({ ...v, desc: e.target.value })}
              placeholder="مثال: تسرب مياه من السقف قرب لوحة الكهرباء"
            />
          </Field>
          <Field label="تقديرك لدرجة الخطورة">
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setV({ ...v, sev: s })}
                  aria-pressed={v.sev === s}
                  className={cn(
                    "min-h-11 rounded-lg border text-sm font-bold",
                    v.sev === s ? "border-national bg-national text-white" : "bg-white",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="صور (يُنصح بها)">
            <PhotoPicker files={files} onChange={setFiles} />
          </Field>
          <Button size="lg" disabled={send.isPending || !v.building || !v.desc.trim()}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إرسال البلاغ
          </Button>
        </form>
      </Panel>
    </div>
  );
}
