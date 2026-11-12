import { describe, expect, it } from "vitest";
import { addDays, relDue } from "./format";
import { addWorkdaysJs, projectHealth, projectProgress } from "./projects";
import { goalProgress } from "./goals";
import { suggestClass } from "@/components/task-form";

describe("dates", () => {
  it("adds days across months", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("skips Friday and Saturday when adding workdays", () => {
    // 2026-11-05 is a Thursday → next workday is Sunday 2026-11-08
    expect(addWorkdaysJs("2026-11-05", 1)).toBe("2026-11-08");
  });
  it("describes relative due dates", () => {
    expect(relDue("2026-11-09", "2026-11-09").text).toBe("اليوم");
    expect(relDue("2026-11-12", "2026-11-09")).toEqual({ text: "بعد 3 أيام", tone: "soon" });
    expect(relDue("2026-11-04", "2026-11-09")).toEqual({ text: "متأخرة 5 أيام", tone: "overdue" });
  });
});

describe("classification hint", () => {
  it("flags planned duration over 30 days as long", () => {
    expect(
      suggestClass({ start_date: "2026-01-01", due_date: "2026-02-15", contributors: [] }),
    ).toBe("طويلة");
  });
  it("flags tasks with contributors as complex", () => {
    expect(
      suggestClass({ start_date: "2026-01-01", due_date: "2026-01-10", contributors: ["x"] }),
    ).toBe("معقدة");
  });
  it("defaults to short", () => {
    expect(
      suggestClass({ start_date: "2026-01-01", due_date: "2026-01-10", contributors: [] }),
    ).toBe("قصيرة");
  });
});

describe("projects", () => {
  const ph = (status: string, due: string) => ({
    status,
    due_date: due,
    start_date: null,
    title: "x",
  });
  it("computes progress from completed phases, ignoring cancelled ones", () => {
    expect(
      projectProgress([
        ph("مكتملة", "2026-01-01"),
        ph("لم تبدأ", "2026-02-01"),
        ph("ملغاة", "2026-03-01"),
      ]),
    ).toBe(50);
  });
  it("is late when an open phase is past due", () => {
    expect(projectHealth([ph("قيد التنفيذ", "2026-11-01")], "2026-11-09")).toBe("متأخر");
  });
  it("is at risk when a not-started phase is due within 3 workdays", () => {
    expect(projectHealth([ph("لم تبدأ", "2026-11-11")], "2026-11-09")).toBe("معرّض للتأخر");
  });
  it("is on track otherwise", () => {
    expect(projectHealth([ph("قيد التنفيذ", "2026-12-01")], "2026-11-09")).toBe("على المسار");
  });
});

describe("goals", () => {
  it("measures numeric goals from baseline to target using the latest check-in", () => {
    const g = { measure_type: "نسبة مئوية", baseline_value: 60, target_value: 95 };
    const c = [
      { current_value: 70, created_at: "2026-03-01", rag: "على المسار", quarter: 1 },
      { current_value: 81, created_at: "2026-09-01", rag: "على المسار", quarter: 3 },
    ];
    expect(goalProgress(g, c, [])).toBe(60);
  });
  it("measures milestone goals by achieved milestones", () => {
    expect(
      goalProgress(
        { measure_type: "مراحل", baseline_value: 0, target_value: 4 },
        [],
        [{ status: "تحقق" }, { status: "لم يتحقق" }],
      ),
    ).toBe(50);
  });
});
