import { buildApp } from "./app.js";

/**
 * 启动入口：SERVER_PORT 家族统一键，缺值 fail-fast——禁默认值兜底
 * （suite-hard-rules §1，2026-08-28 漂移事故纪律）。
 */
const port = Number(process.env.SERVER_PORT);
if (!process.env.SERVER_PORT || !Number.isInteger(port) || port <= 0) {
  process.stderr.write(
    "[server] SERVER_PORT 未设置或非法，startup fail-fast，禁默认兜底\n",
  );
  process.exit(1);
}

const app = await buildApp();
await app.listen({ port, host: "0.0.0.0" });
