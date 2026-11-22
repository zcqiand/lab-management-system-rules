import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import FnReporter from "./tests/fnReporter.mjs";

/**
 * vitest 配置（node-service）：
 *  1. node 环境（无 DOM 依赖）
 *  2. FnReporter 挂 reporters——TRACE_MAP=1 时落 .state/trace.json（suite trace 契约）
 *  3. `@` alias → src/——家族引擎测试 import 面（@/lib/calc-engine/...）不改一字
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    reporters: ["default", new FnReporter()],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
