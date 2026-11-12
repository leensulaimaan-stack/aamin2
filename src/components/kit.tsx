import { useEffect, useState, type ReactNode } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { relDue, riyadhToday, useFmt } from "@/lib/format";
import { signedPhotoUrls } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- pills ---------- */
const pillTone: Record<string, string> = {
  // task
  "لم تبدأ": "bg-water text-ink",
  "قيد التنفيذ": "bg-white text-leaf ring-1 ring-inset ring-leaf",
  "بانتظار جهة خارجية": "bg-white text-purple ring-1 ring-inset ring-purple",
  مكتملة: "bg-leaf text-white",
  ملغاة: "bg-white text-ink ring-1 ring-inset ring-ink",
  // inspection
  "بانتظار الاعتماد": "bg-arfaj text-ink",
  معتمدة: "bg-leaf text-white",
  مرفوضة: "bg-alert text-white",
  // finding
  مفتوحة: "bg-water text-ink",
  "قيد المعالجة": "bg-white text-leaf ring-1 ring-inset ring-leaf",
  "بانتظار التحقق": "bg-arfaj text-ink",
  مغلقة: "bg-leaf text-white",
  // reports
  "بانتظار المراجعة": "bg-arfaj text-ink",
  حُوّلت: "bg-leaf text-white",
  رُفضت: "bg-white text-ink ring-1 ring-inset ring-ink",
  // due / health
  overdue: "bg-alert text-white",
  soon: "bg-arfaj text-ink",
  later: "bg-water text-ink",
  متأخر: "bg-alert text-white",
  "معرّض للتأخر": "bg-arfaj text-ink",
  "على المسار": "bg-leaf text-white",
  "معرّض للخطر": "bg-arfaj text-ink",
  متعثر: "bg-alert text-white",
  نشط: "bg-water text-ink",
  مكتمل: "bg-leaf text-white",
  ملغى: "bg-white text-ink ring-1 ring-inset ring-ink",
};

export function Pill({
  tone,
  children,
  className,
}: {
  tone: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        pillTone[tone] ?? "bg-water text-ink",
        className,
      )}
    >
      {children ?? tone}
    </span>
  );
}

const sevTone: Record<string, string> = {
  منخفضة: "bg-water text-ink",
  متوسطة: "bg-arfaj text-ink",
  عالية: "bg-sun text-alert ring-1 ring-inset ring-alert/40",
  حرجة: "bg-alert text-white",
};
export function SeverityPill({ sev }: { sev: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        sevTone[sev] ?? "bg-water",
      )}
    >
      {sev}
    </span>
  );
}

export function ClassChip({ cls }: { cls: string | null }) {
  if (!cls) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-mint/70 px-2 py-0.5 text-[11px] font-medium text-national">
      {cls}
    </span>
  );
}

export function DueText({ due, done }: { due: string; done?: boolean }) {
  const { date } = useFmt();
  if (done) return <span className="text-xs text-muted-foreground">{date(due)}</span>;
  const r = relDue(due, riyadhToday());
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {date(due)}
      <Pill tone={r.tone}>{r.text}</Pill>
    </span>
  );
}

/* ---------- layout ---------- */
export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight [text-wrap:balance]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Panel({
  className,
  title,
  action,
  children,
}: {
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-water/60 px-4 py-7 text-center text-sm font-medium text-national">
      <img src="/brand/nhc-symbol-green.png" alt="" className="h-8 w-8 opacity-60" />
      <div>{children}</div>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl bg-water/70" />
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "bg-card",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  onClick?: () => void;
}) {
  const C = onClick ? "button" : "div";
  return (
    <C
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-start",
        tone,
        onClick && "transition-shadow hover:shadow-md",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-national">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </C>
  );
}

export function Ring({
  value,
  total,
  label,
  size = 128,
}: {
  value: number;
  total: number;
  label: string;
  size?: number;
}) {
  const { n } = useFmt();
  const pct = total ? Math.min(1, value / total) : 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--water)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--leaf)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center">
        <div className="text-xl font-bold tabular-nums text-national">
          {n(value)}/{n(total)}
        </div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function PctRing({
  pct,
  label,
  size = 96,
  tone = "var(--leaf)",
}: {
  pct: number;
  label?: string | undefined;
  size?: number;
  tone?: string | undefined;
}) {
  const { n } = useFmt();
  const r = 42;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--water)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
        />
      </svg>
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums text-national">{n(p)}٪</div>
        {label && <div className="text-[10px] text-muted-foreground">{label}</div>}
      </div>
    </div>
  );
}

export function Bar({
  pct,
  target,
  tone = "bg-leaf",
}: {
  pct: number;
  target?: number;
  tone?: string;
}) {
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-water"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700", tone)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      {target !== undefined && target < 100 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-national"
          style={{ insetInlineStart: `${target}%` }}
        />
      )}
    </div>
  );
}

export function Avatar({
  name,
  className,
}: {
  name?: string | null | undefined;
  className?: string;
}) {
  const init = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-xs font-bold text-national",
        className,
      )}
    >
      {init}
    </span>
  );
}

/* ---------- forms ---------- */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-leaf disabled:opacity-60";

export function NativeSelect({
  value,
  onChange,
  children,
  className,
  required,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
}) {
  return (
    <select
      aria-label={ariaLabel}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputCls, "appearance-auto", className)}
    >
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  const { n } = useFmt();
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-water/70 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-national transition-colors",
            value === o.value ? "bg-white shadow-sm" : "hover:bg-white/50",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="rounded-full bg-national/10 px-1.5 text-[11px] tabular-nums">
              {n(o.count)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- dialogs ---------- */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  danger,
  busy,
  onConfirm,
  children,
  confirmDisabled,
  hideFooter,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
  hideFooter?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle className="text-national">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {!hideFooter && (
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
              className={danger ? "bg-alert text-white hover:bg-alert/90" : ""}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- photos ---------- */
export function PhotoPicker({
  files,
  onChange,
  label = "إضافة صورة",
  max = 6,
}: {
  files: File[];
  onChange: (f: File[]) => void;
  label?: string;
  max?: number;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <div key={u} className="relative h-20 w-20 overflow-hidden rounded-lg border">
          <img src={u} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="حذف الصورة"
            onClick={() => onChange(files.filter((_, k) => k !== i))}
            className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {files.length < max && (
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-leaf/50 text-center text-[11px] font-medium text-leaf hover:bg-mint/30">
          <span className="flex flex-col items-center gap-1">
            <Camera className="h-5 w-5" />
            {label}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) =>
              onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, max))
            }
          />
        </label>
      )}
    </div>
  );
}

export function PhotoStrip({ paths, size = "h-16 w-16" }: { paths: string[]; size?: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const key = paths.join("|");
  useEffect(() => {
    let alive = true;
    signedPhotoUrls(paths).then((u) => alive && setUrls(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!paths.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.length === 0 &&
          paths.map((p) => (
            <div
              key={p}
              className={cn(
                "grid place-items-center rounded-lg bg-water text-[10px] text-muted-foreground",
                size,
              )}
            >
              صورة
            </div>
          ))}
        {urls.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setOpen(u)}
            className={cn("overflow-hidden rounded-lg border", size)}
          >
            <img src={u} alt="صورة توثيق" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">صورة</DialogTitle>
          {open && (
            <img
              src={open}
              alt="صورة توثيق"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
