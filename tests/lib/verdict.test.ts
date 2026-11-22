import { describe, expect, it } from "vitest";
import { autoVerdict } from "@/lib/verdict.js";

// Task 11 Step 1：autoVerdict 语义逐字面镜像 nextjs
// src/features/data-entry/models/cement-strength.ts autoVerdict——
// ≥→minValue / ≤→maxValue / range 或 valueType=range → 双界 / 其余或缺失 → ""。
// 纯函数单测（工程面，不挂业务 fn-ID；fn 锚挂 calc 路由测试面）。

type Req = {
  comparison: string;
  minValue: number | null;
  maxValue: number | null;
  valueType: string;
};

describe("autoVerdict", () => {
  it("≥ + minValue：达界合格 / 未达不合格", () => {
    const req: Req = {
      comparison: "≥",
      minValue: 32.5,
      maxValue: null,
      valueType: "numeric",
    };
    expect(autoVerdict(32.5, req)).toBe("合格");
    expect(autoVerdict(32.4, req)).toBe("不合格");
  });

  it("≤ + maxValue：未超合格 / 超界不合格", () => {
    const req: Req = {
      comparison: "≤",
      minValue: null,
      maxValue: 8000,
      valueType: "numeric",
    };
    expect(autoVerdict(8000, req)).toBe("合格");
    expect(autoVerdict(8001, req)).toBe("不合格");
  });

  it("range 双界：界内合格 / 界外不合格", () => {
    const req: Req = {
      comparison: "range",
      minValue: 10,
      maxValue: 20,
      valueType: "numeric",
    };
    expect(autoVerdict(10, req)).toBe("合格");
    expect(autoVerdict(15, req)).toBe("合格");
    expect(autoVerdict(20.1, req)).toBe("不合格");
  });

  it("valueType=range 单触：comparison 非 ≥/≤（如 =）时 valueType=range 同双界", () => {
    const req: Req = { comparison: "=", minValue: 10, maxValue: 20, valueType: "range" };
    expect(autoVerdict(15, req)).toBe("合格");
    expect(autoVerdict(25, req)).toBe("不合格");
    expect(autoVerdict(5, req)).toBe("不合格");
  });

  it("mean undefined → 空串（无法判定）", () => {
    const req: Req = {
      comparison: "≥",
      minValue: 1,
      maxValue: null,
      valueType: "numeric",
    };
    expect(autoVerdict(undefined, req)).toBe("");
  });

  it("techReq undefined → 空串（无可比要求）", () => {
    expect(autoVerdict(5, undefined)).toBe("");
  });

  it("comparison 无枚举命中 → 空串（如 = 无界值）", () => {
    const req: Req = {
      comparison: "=",
      minValue: null,
      maxValue: null,
      valueType: "numeric",
    };
    expect(autoVerdict(5, req)).toBe("");
  });
});
