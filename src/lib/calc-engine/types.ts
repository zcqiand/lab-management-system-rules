// 公式求值引擎内核类型（批 2；spec §5 API 形状，批 3a 直接扩建）。
// 零 IO 纯函数域；求值器自研遍历器，禁 eval/new Function（spec §3.2）。

export type CalcErrorCode =
  "FORMULA_PARSE_ERROR" | "CONTEXT_KEY_MISSING" | "DIVIDE_BY_ZERO";

export interface CalcError {
  code: CalcErrorCode;
  /** 语法错位置（FORMULA_PARSE_ERROR 专用） */
  position?: number;
  message: string;
  /** 试件组序（逐组错误专用） */
  group?: number;
}

export interface CalcInput {
  /** calc 表 formula 列原文 */
  formula: string;
  /** 每组试件一个上下文（批 3a 装配器产物） */
  contexts: Record<string, number>[];
}

export interface CalcOutput {
  /** 逐组结果；无效组 = null（非 0，不兜 0——suite 硬规则 §3） */
  strengths: (number | null)[];
  /** 有效组全精度均值；无有效组 = null（引擎不修约，展示口径归调用侧） */
  mean: number | null;
  errors: CalcError[];
}
