// 求值器（批 2）：spec §5 CalcInput→CalcOutput。
// 解析错整批拒绝（strengths 全 null + 恰 1 条 FORMULA_PARSE_ERROR）；逐组错误记 errors，
// 该组 null 非 0（禁兜 0，suite 硬规则 §3）；mean = 有效组全精度均值，引擎不再修约。
import { isFormulaSyntaxError, parseFormula, type AstNode } from "./parser";
import { ENGINE_FUNCTIONS } from "./functions";
import type { CalcInput, CalcOutput, CalcError } from "./types";

export function evaluateFormula(input: CalcInput): CalcOutput {
  let ast: AstNode;
  try {
    ast = parseFormula(input.formula);
  } catch (e) {
    if (isFormulaSyntaxError(e)) {
      return {
        strengths: input.contexts.map(() => null),
        mean: null,
        errors: [
          { code: "FORMULA_PARSE_ERROR", position: e.position, message: e.message },
        ],
      };
    }
    throw e;
  }

  const strengths: (number | null)[] = [];
  const errors: CalcError[] = [];
  input.contexts.forEach((ctx, i) => {
    try {
      const v = evalNode(ast, ctx);
      strengths.push(Number.isFinite(v) ? v : null);
      if (!Number.isFinite(v)) {
        errors.push({
          code: "CONTEXT_KEY_MISSING",
          group: i,
          message: "non-finite result",
        });
      }
    } catch (e) {
      strengths.push(null);
      const code = isDivideByZero(e) ? "DIVIDE_BY_ZERO" : "CONTEXT_KEY_MISSING";
      errors.push({
        code,
        group: i,
        message: e instanceof Error ? e.message : "eval error",
      });
    }
  });

  const valid = strengths.filter((v): v is number => v !== null);
  const mean = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  return { strengths, mean, errors };
}

function isDivideByZero(e: unknown): boolean {
  return e instanceof Error && e.message === "DIVIDE_BY_ZERO";
}

function evalNode(node: AstNode, ctx: Record<string, number>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ident": {
      const v = ctx[node.name];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`CONTEXT_KEY_MISSING: ${node.name}`);
      }
      return v;
    }
    case "call": {
      const fn = ENGINE_FUNCTIONS[node.name];
      if (!fn) throw new Error(`CONTEXT_KEY_MISSING: ${node.name}`);
      const args = node.args.map((a) => evalNode(a, ctx));
      return fn(args);
    }
    case "unary":
      return -evalNode(node.operand, ctx);
    case "binary": {
      const l = evalNode(node.left, ctx);
      const r = evalNode(node.right, ctx);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          if (r === 0) throw new Error("DIVIDE_BY_ZERO");
          return l / r;
        case "^":
          return l ** r;
      }
      throw new Error("unreachable operator");
    }
  }
}
