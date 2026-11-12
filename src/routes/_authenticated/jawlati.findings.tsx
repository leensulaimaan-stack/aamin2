import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { riyadhToday, useFmt } from "@/lib/format";
import { useBuildings, useNames } from "@/lib/data";
import { SEVERITIES } from "@/lib/constants";
import { exportXlsx } from "@/lib/export";
import {
  ConfirmDialog,
  DueText,
  Empty,
  Field,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  PhotoStrip,
  Pill,
  Segmented,
  SeverityPill,
  Stat,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/jawlati/findings")({
  head: () => ({ meta: [{ title: "الملاحظات والإجراءات | آمن" }] }),
  component: Findings,
});

const STATUSES = ["مفتوحة", "قيد المعالجة", "بانتظار التحقق", "مغلقة"];

function Findings() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const name = useNames();
  const buildings = useBuildings();
  const { n, date } = useFmt();
  const today = riyadhToday();
  const [tab, setTab] = useState<"findings" | "reports">("findings");
  const [f, setF] = useState({ building: "", severity: "", status: "", overdue: false });
  const [verify, setVerify] = useState<{ id: string; accept: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<{
    id: string;
    mode: "convert" | "dismiss";
    sev: string;
  } | null>(null);

  const q = useQuery({
    queryKey: ["findings"],
    queryFn: async () => {
      const [fi, rep] = await Promise.all([
        supabase
          .from("findings")
          .select(
            "*, buildings!findings_building_id_fkey(code, name), checklist_items!findings_item_id_fkey(text, code), tasks!findings_corrective_task_id_fkey(id, owner_id, due_date, status)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("finding_reports")
          .select("*, buildings!finding_reports_building_id_fkey(code, name)")
          .order("created_at", { ascending: false }),
      ]);
      if (fi.error) throw fi.error;
      return { findings: fi.data ?? [], reports: rep.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["findings"] });
  const verifyM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("verify_finding", {
        p_id: verify!.id,
        p_accept: verify!.accept,
        ...(verify!.accept ? {} : { p_reason: reason.trim() }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(verify!.accept ? "أُغلقت الملاحظة" : "أُعيدت للمعالجة");
      setVerify(null);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const reportM = useMutation({
    mutationFn: async () => {
      const { error } =
        report!.mode === "convert"
          ? await supabase.rpc("convert_report", { p_id: report!.id, p_sev: report!.sev })
          : await supabase.rpc("dismiss_report", { p_id: report!.id, p_reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        report!.mode === "convert" ? "حُوّل البلاغ إلى ملاحظة بإجراء تصحيحي" : "استُبعد البلاغ",
      );
      setReport(null);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const all = q.data?.findings ?? [];
  const isLate = (x: (typeof all)[number]) =>
    x.status !== "مغلقة" && !!x.tasks && x.tasks.due_date < today;
  const rows = all.filter(
    (x) =>
      (!f.building || x.building_id === f.building) &&
      (!f.severity || x.severity === f.severity) &&
      (!f.status || x.status === f.status) &&
      (!f.overdue || isLate(x)),
  );
  const openAll = all.filter((x) => x.status !== "مغلقة");
  const pendingReports = (q.data?.reports ?? []).filter((r) => r.status === "بانتظار المراجعة");

  function exportRows() {
    exportXlsx(
      "سجل-الملاحظات",
      "الملاحظات",
      rows.map((x) => ({
        المبنى: x.buildings?.code ?? "",
        القسم: x.checklist_items?.code?.[0] ?? (x.report_id ? "بلاغ" : ""),
        البند: x.checklist_items?.text ?? x.description ?? "",
        الخطورة: x.severity,
        الموقع: x.floor_or_area ?? "",
        "تاريخ الرصد": x.created_at.slice(0, 10),
        المسؤول: name(x.tasks?.owner_id),
        "موعد الإغلاق": x.tasks?.due_date ?? "",
        الحالة: x.status,
      })),
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="الملاحظات والإجراءات التصحيحية"
        sub="كل بند «غير مطابق» في جولة معتمدة، وكل بلاغ معتمد، يصبح إجراءً تصحيحياً بمسؤول وموعد حسب الخطورة"
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/jawlati/report">
                <Megaphone className="h-4 w-4" /> إبلاغ عن ملاحظة
              </Link>
            </Button>
            <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
              <Download className="h-4 w-4" /> تصدير Excel
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SEVERITIES.slice()
          .reverse()
          .map((s) => (
            <Stat
              key={s}
              label={`مفتوحة — ${s}`}
              value={n(openAll.filter((x) => x.severity === s).length)}
              tone={
                s === "حرجة" && openAll.some((x) => x.severity === s) ? "bg-alert/10" : "bg-card"
              }
              onClick={() => setF({ ...f, severity: s, status: "" })}
            />
          ))}
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "findings", label: "سجل الملاحظات", count: rows.length },
          { value: "reports", label: "بلاغات الموظفين", count: pendingReports.length },
        ]}
      />

      {tab === "findings" && (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <NativeSelect
              ariaLabel="المبنى"
              value={f.building}
              onChange={(v) => setF({ ...f, building: v })}
            >
              <option value="">كل المباني</option>
              {(buildings.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              ariaLabel="الخطورة"
              value={f.severity}
              onChange={(v) => setF({ ...f, severity: v })}
            >
              <option value="">كل درجات الخطورة</option>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
            <NativeSelect
              ariaLabel="الحالة"
              value={f.status}
              onChange={(v) => setF({ ...f, status: v })}
            >
              <option value="">كل الحالات</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={f.overdue}
                onChange={(e) => setF({ ...f, overdue: e.target.checked })}
                className="h-4 w-4 accent-[var(--leaf)]"
              />{" "}
              المتأخرة فقط
            </label>
          </div>
          {q.isLoading ? (
            <ListSkeleton />
          ) : rows.length === 0 ? (
            <Empty>لا توجد ملاحظات تطابق هذا البحث.</Empty>
          ) : (
            <div className="space-y-2">
              {rows.map((x) => {
                const canVerify = !!me?.isStaff && x.status === "بانتظار التحقق";
                return (
                  <div key={x.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityPill sev={x.severity} />
                      <b className="text-national">{x.buildings?.code}</b>
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {x.checklist_items?.text ?? x.description}
                      </span>
                      <Pill tone={x.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {x.floor_or_area && <span>الموقع: {x.floor_or_area}</span>}
                      <span>رُصدت {date(x.created_at.slice(0, 10))}</span>
                      {x.tasks && <span>المسؤول: {name(x.tasks.owner_id)}</span>}
                      {x.tasks && x.status !== "مغلقة" && <DueText due={x.tasks.due_date} />}
                      {x.report_id && <Pill tone="later">من بلاغ موظف</Pill>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-6">
                      {x.photo_paths.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">قبل</div>
                          <PhotoStrip paths={x.photo_paths} size="h-14 w-14" />
                        </div>
                      )}
                      {x.closure_photo_paths.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">بعد</div>
                          <PhotoStrip paths={x.closure_photo_paths} size="h-14 w-14" />
                        </div>
                      )}
                    </div>
                    {x.closure_note && <p className="mt-2 text-sm">المعالجة: {x.closure_note}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {x.tasks && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/tasks/$id" params={{ id: x.tasks.id }}>
                            الإجراء التصحيحي
                          </Link>
                        </Button>
                      )}
                      {canVerify && (
                        <Button
                          size="sm"
                          className="bg-leaf hover:bg-leaf/90"
                          onClick={() => setVerify({ id: x.id, accept: true })}
                        >
                          تأكيد الإغلاق
                        </Button>
                      )}
                      {canVerify && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-alert"
                          onClick={() => setVerify({ id: x.id, accept: false })}
                        >
                          إعادة للمعالجة
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "reports" && (
        <div className="space-y-2">
          {(q.data?.reports ?? []).length === 0 ? (
            <Empty>لا توجد بلاغات. يستطيع أي موظف الإبلاغ من زر «إبلاغ عن ملاحظة».</Empty>
          ) : (
            q.data!.reports.map((r) => (
              <Panel key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityPill sev={r.severity} />
                  <b className="text-national">{r.buildings?.code}</b>
                  <span className="flex-1 text-sm font-medium">{r.description}</span>
                  <Pill tone={r.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {name(r.reporter_id)} · {date(r.created_at.slice(0, 10))}
                  {r.floor_or_area ? ` · ${r.floor_or_area}` : ""}
                  {r.dismiss_reason ? ` · سبب الاستبعاد: ${r.dismiss_reason}` : ""}
                </div>
                <div className="mt-2">
                  <PhotoStrip paths={r.photo_paths} size="h-14 w-14" />
                </div>
                {me?.isStaff && r.status === "بانتظار المراجعة" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setReport({ id: r.id, mode: "convert", sev: r.severity })}
                    >
                      تحويل إلى ملاحظة رسمية
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReport({ id: r.id, mode: "dismiss", sev: r.severity })}
                    >
                      استبعاد
                    </Button>
                  </div>
                )}
              </Panel>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!verify}
        onOpenChange={(v) => !v && setVerify(null)}
        title={verify?.accept ? "تأكيد إغلاق الملاحظة" : "إعادة الملاحظة للمعالجة"}
        description={
          verify?.accept ? "راجعت صورة ما بعد المعالجة وتأكدت من زوال الخطر." : undefined
        }
        confirmLabel={verify?.accept ? "إغلاق" : "إعادة"}
        danger={!verify?.accept}
        confirmDisabled={!verify?.accept && !reason.trim()}
        busy={verifyM.isPending}
        onConfirm={() => verifyM.mutate()}
      >
        {!verify?.accept && (
          <Field label="السبب">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!report}
        onOpenChange={(v) => !v && setReport(null)}
        title={report?.mode === "convert" ? "تحويل البلاغ إلى ملاحظة" : "استبعاد البلاغ"}
        confirmLabel={report?.mode === "convert" ? "تحويل" : "استبعاد"}
        confirmDisabled={report?.mode === "dismiss" && !reason.trim()}
        busy={reportM.isPending}
        onConfirm={() => reportM.mutate()}
      >
        {report?.mode === "convert" ? (
          <Field label="درجة الخطورة المعتمدة" hint="تحدد موعد الإجراء التصحيحي">
            <NativeSelect value={report.sev} onChange={(v) => setReport({ ...report, sev: v })}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field label="سبب الاستبعاد (يصل للمبلّغ)">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );
}
