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
);
