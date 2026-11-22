// Task 11：autoVerdict 语义逐字面镜像 nextjs
// src/features/data-entry/models/cement-strength.ts autoVerdict——
// ≥→minValue / ≤→maxValue / range 或 valueType=range → 双界 / 其余或缺失 → ""。
// verdict 归服务（plan R2 裁定）：rules 复算链路自己判定，不依赖前端回传。

export type TechReqLike = {
  comparison: string;
  minValue: number | null;
  maxValue: number | null;
  valueType: string;
};

export type Verdict = "合格" | "不合格" | "";

export function autoVerdict(
  mean: number | undefined,
  req: TechReqLike | undefined,
): Verdict {
  if (mean === undefined || !req) return "";
  const { comparison, minValue, maxValue, valueType } = req;
  if (comparison === "≥" && minValue != null) return mean >= minValue ? "合格" : "不合格";
  if (comparison === "≤" && maxValue != null) return mean <= maxValue ? "合格" : "不合格";
  if (
    (comparison === "range" || valueType === "range") &&
    minValue != null &&
    maxValue != null
  )
    return mean >= minValue && mean <= maxValue ? "合格" : "不合格";
  return "";
}
