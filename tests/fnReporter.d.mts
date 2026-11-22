/**
 * tests/fnReporter.mjs（suite 锚点适配器，angular 同款 verbatim 锚点件）的类型声明。
 * 声明文件不参与 sync_always——锚点件本体 byte 等价纪律只约束实现文件。
 */
export default class FnReporter {
  /** vitest >= 3 */
  onTestRunEnd(testModules: readonly unknown[], ...rest: unknown[]): void;
  /** vitest 2 */
  onFinished(files?: readonly unknown[]): void;
}
