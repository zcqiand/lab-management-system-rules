// 内置函数库（函数库只增不改，spec §3.2）：批 2 注册 PI、ROUND_HALF_EVEN；
// R2 calc 段增 avg（算术均值，brief 用例①公式形状；空参 NaN 由求值器 non-finite→null 兜）。
export const ENGINE_FUNCTIONS: Record<string, (args: number[]) => number> = {
  PI: () => Math.PI,
  ROUND_HALF_EVEN: (args) => roundHalfEven(args[0]!, args[1]!),
  avg: (args) => args.reduce((a, b) => a + b, 0) / args.length,
};

/**
 * GB/T 8170 四舍六入五成双（批 2 断言基准，spec §9-1 人裁）。
 * 缩放整数 + tie 检测 epsilon 1e-9（兜 2.675*100=267.4999… 类浮点噪声；
 * 禁引 decimal.js——version-lock，spec §8）。
 */
export function roundHalfEven(x: number, digits: number): number {
  const scale = 10 ** digits;
  const scaled = x * scale;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  if (Math.abs(diff - 0.5) < 1e-9) {
    const even = floor % 2 === 0 ? floor : floor + 1;
    return even / scale;
  }
  return Math.round(scaled) / scale;
}
