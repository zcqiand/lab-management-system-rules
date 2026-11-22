import { test } from "vitest";
import { expect } from "vitest";
import { buildApp } from "@/app";

// 工程设施测试不挂业务 fn-ID（fn.ts 纪律）；R2 起各域端点测试用 fnTest 挂 ID。
test("GET /healthz 返回 200 {ok:true}（家族探活契约）", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/healthz" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true });
  await app.close();
});
