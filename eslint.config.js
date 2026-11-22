import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 家族 stack_rules：禁 any 无 ADR。适配器不豁免于它所服务的规则。
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  },
  {
    // tests/fnReporter.mjs 是 suite 锚点适配器（angular 同款 verbatim 锚点件，
    // sync_always 强制覆盖禁本地改）——裸 .mjs 不吃 @types/node，
    // 定向补 node globals；禁在此文件上做本地逻辑改动。
    files: ["tests/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
);
