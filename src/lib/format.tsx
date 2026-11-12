import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { arabicDigits: boolean; setArabicDigits: (v: boolean) => void };
const NumCtx = createContext<Ctx>({ arabicDigits: false, setArabicDigits: () => {} });

export function NumeralsProvider({ children }: { children: ReactNode }) {
  const [arabicDigits, setState] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("aamin-digits") === "arab") setState(true);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setArabicDigits = (v: boolean) => {
    setState(v);
    try {
      localStorage.setItem("aamin-digits", v ? "arab" : "latn");
    } catch {
      /* storage unavailable */
    }
  };
  return <NumCtx.Provider value={{ arabicDigits, setArabicDigits }}>{children}</NumCtx.Provider>;
}

export function useFmt() {
  const { arabicDigits, setArabicDigits } = useContext(NumCtx);
  const locale = `ar-SA-u-ca-gregory-nu-${arabicDigits ? "arab" : "latn"}`;
  const n = (v: number | null | undefined, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v ?? 0);
  const date = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dt = typeof d === "string" && d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Riyadh",
    }).format(dt);
  };
  const month = (d: string | Date) => {
    const dt = typeof d === "string" ? new Date(d.slice(0, 10) + "T12:00:00") : d;
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(dt);
  };
  const shortMonth = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(d.slice(0, 10) + "T12:00:00"),
    );
  return { n, date, month, shortMonth, arabicDigits, setArabicDigits };
}

/** Today's date in Asia/Riyadh as YYYY-MM-DD */
export function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}
export function riyadhDate(ts: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(ts));
}
export function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000,
  );
}
export function monthStart(d: string) {
  return d.slice(0, 7) + "-01";
}
export function addMonths(d: string, m: number) {
  const dt = new Date(d.slice(0, 7) + "-01T00:00:00Z");
  dt.setUTCMonth(dt.getUTCMonth() + m);
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Relative due text: "اليوم" / "بعد 3 أيام" / "متأخرة 5 أيام" */
export function relDue(due: string, today = riyadhToday()) {
  const d = daysBetween(today, due);
  if (d === 0) return { text: "اليوم", tone: "soon" as const };
  if (d === 1) return { text: "غداً", tone: "soon" as const };
  if (d > 1)
    return {
      text: `بعد ${d} ${d <= 10 ? "أيام" : "يوماً"}`,
      tone: d <= 3 ? ("soon" as const) : ("later" as const),
    };
  const a = -d;
  return {
    text: `متأخرة ${a} ${a === 1 ? "يوم" : a <= 10 ? "أيام" : "يوماً"}`,
    tone: "overdue" as const,
  };
}

export function isWorkday(d: string) {
  const dow = new Date(d + "T12:00:00Z").getUTCDay();
  return dow !== 5 && dow !== 6;
}
