// 引擎内核单元测试（批 2）：文法（spec §3.1）/ 内置函数（§3.2）/ 求值与错误路径（§5）。
// 一致性测试（引擎 ↔ REGISTRY 代码）在 consistency.test.ts，另文件。
import { describe, expect, it } from "vitest";
import { evaluateFormula } from "@/lib/calc-engine/evaluate";
import { roundHalfEven } from "@/lib/calc-engine/functions";
import { isFormulaSyntaxError, parseFormula } from "@/lib/calc-engine/parser";

/** 捕获同步 throw；不抛即失败（断言错误形状用）。 */
function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected fn to throw");
}

// 定稿表达式（spec §3.3，与 vendor 种子逐字同源）
const FORMULA_STRENGTH = "ROUND_HALF_EVEN(Fm / (PI() * d^2 / 4), 1)";
const FORMULA_RATIO = "ROUND_HALF_EVEN(Rm / ReH, 2)";

describe("roundHalfEven 五成双", () => {
  it("tie 向偶收敛", () => {
    expect(roundHalfEven(1.125, 2)).toBe(1.12);
    expect(roundHalfEven(1.135, 2)).toBe(1.14);
    expect(roundHalfEven(0.25, 1)).toBe(0.2);
    expect(roundHalfEven(0.35, 1)).toBe(0.4);
    expect(roundHalfEven(-2.5, 0)).toBe(-2);
    expect(roundHalfEven(450 / 400, 2)).toBe(1.12);
  });

  it("epsilon 兜浮点噪声 tie", () => {
    expect(roundHalfEven(2.675, 2)).toBe(2.68);
  });

  it("非 tie 正常收敛", () => {
    expect(roundHalfEven(1.126, 2)).toBe(1.13);
    expect(roundHalfEven(999999.4, 1)).toBe(999999.4);
    expect(roundHalfEven(999999.45, 1)).toBe(999999.4);
  });
});

describe("文法", () => {
  it("优先级：2+3*4^2 = 50", () => {
    const out = evaluateFormula({ formula: "2+3*4^2", contexts: [{}] });
    expect(out.strengths).toEqual([50]);
    expect(out.errors).toEqual([]);
  });

  it("右结合：2^3^2 = 512", () => {
    const out = evaluateFormula({ formula: "2^3^2", contexts: [{}] });
    expect(out.strengths).toEqual([512]);
  });

  it("一元负号作用于幂：-3^2 = -9", () => {
    const out = evaluateFormula({ formula: "-3^2", contexts: [{}] });
    expect(out.strengths).toEqual([-9]);
  });

  it("括号：(2+3)*4 = 20", () => {
    const out = evaluateFormula({ formula: "(2+3)*4", contexts: [{}] });
    expect(out.strengths).toEqual([20]);
  });

  it("大小写敏感 fm≠Fm", () => {
    const out = evaluateFormula({
      formula: FORMULA_STRENGTH,
      contexts: [{ fm: 82400, d: 25 }],
    });
    expect(out.strengths[0]).toBeNull();
    expect(out.errors[0]!.code).toBe("CONTEXT_KEY_MISSING");
  });

  it("未知函数名解析期报错", () => {
    const err = captureError(() => parseFormula("FOO(1)"));
    expect(isFormulaSyntaxError(err)).toBe(true);
    expect((err as { position: number }).position).toBe(0);
  });
});

describe("函数与常量", () => {
  it("PI = Math.PI", () => {
    const out = evaluateFormula({ formula: "PI()", contexts: [{}] });
    expect(out.strengths).toEqual([Math.PI]);
  });

  it("ROUND 内嵌组合", () => {
    const out = evaluateFormula({
      formula: "ROUND_HALF_EVEN(ROUND_HALF_EVEN(1.125, 2) + 0.1, 2)",
      contexts: [{}],
    });
    expect(out.strengths).toEqual([1.22]);
  });
});

describe("错误路径", () => {
  it("除零：DIVIDE_BY_ZERO 该组 null", () => {
    const out = evaluateFormula({ formula: "1/0", contexts: [{}] });
    expect(out.strengths).toEqual([null]);
    expect(out.errors[0]!.code).toBe("DIVIDE_BY_ZERO");
    expect(out.mean).toBeNull();
  });

  it("混合上下文：缺键组 null，有效组照算，mean 只取有效组", () => {
    const out = evaluateFormula({
      formula: FORMULA_RATIO,
      contexts: [{}, { Rm: 561.1, ReH: 412.3 }],
    });
    expect(out.strengths[0]).toBeNull();
    expect(out.errors[0]!.code).toBe("CONTEXT_KEY_MISSING");
    expect(out.strengths[1]).toBe(1.36);
    expect(out.mean).toBe(1.36);
  });

  it("解析错整批拒绝", () => {
    const out = evaluateFormula({ formula: "1+", contexts: [{}, {}] });
    expect(out.strengths).toEqual([null, null]);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]!.code).toBe("FORMULA_PARSE_ERROR");
    expect(out.errors[0]!.position).toBe(2);
    expect(out.mean).toBeNull();
  });

  it("缺参/非整数位数 = FORMULA_PARSE_ERROR", () => {
    const e1 = captureError(() => parseFormula("ROUND_HALF_EVEN(1.5)"));
    expect(isFormulaSyntaxError(e1)).toBe(true);
    const e2 = captureError(() => parseFormula("ROUND_HALF_EVEN(1.5, 1.5)"));
    expect(isFormulaSyntaxError(e2)).toBe(true);
  });
});
