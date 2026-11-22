import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { catalogRoutes } from "./routes/catalog.js";
import { paramInterfaceRoutes } from "./routes/param-interfaces.js";
import { reportNameRoutes } from "./routes/report-names.js";
import { reportNameInterfaceRoutes } from "./routes/report-name-interfaces.js";
import { technicalRequirementRoutes } from "./routes/technical-requirements.js";
import { calculationMethodRoutes } from "./routes/calculation-methods.js";
import { calcRoutes } from "./routes/calc.js";
import { requireEnv } from "./lib/env-required.js";
import { LabJwtSigner } from "./lib/auth/jwt.js";
import type { SaasFetch } from "./lib/auth/saas-client.js";

declare module "fastify" {
  interface FastifyInstance {
    labJwt: LabJwtSigner;
  }
}

/**
 * 纯装配：注册路由，不 listen。测试与 server.ts 共用。
 * 各域路由（R2 起五域 + calc）一律挂在这里，禁散落启动面。
 * opts.saasFetch 仅测试注入（打桩 saas upstream）；缺省=全局 fetch。
 */
export async function buildApp(
  opts: { saasFetch?: SaasFetch } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // 空 body + json content-type 宽容（家族后端语义对齐）：axios/HTTP 客户端普遍
  // 全请求带 content-type: application/json，DELETE/GET 无 body 时 Fastify 默认
  // 400 FST_ERR_CTP_EMPTY_JSON_BODY，与 springboot/aspnetcore/go 的宽容语义分叉
  // （2026-11-22 CT live 实证）。空串→undefined，非空照常 JSON.parse。
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      if (body === "" || body == null) return done(null, undefined);
      try {
        done(null, JSON.parse(body as string));
      } catch (cause) {
        done(cause as Error, undefined);
      }
    },
  );

  // JWT signer（M01.F05.I06）——LAB_JWT_SECRET ≥32 字节 fail-fast（ADR-0019）
  const labJwt = new LabJwtSigner(
    requireEnv("LAB_JWT_SECRET"),
    requireEnv("LAB_JWT_ISSUER"),
    Number(requireEnv("LAB_JWT_TTL_SECONDS")),
  );
  app.decorate("labJwt", labJwt);

  // CORS allowlist：LAB_CORS_ALLOWED_ORIGINS 逗号分隔（家族 §6 对称纪律）
  const corsOrigins = requireEnv("LAB_CORS_ALLOWED_ORIGINS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await app.register(cors, { origin: corsOrigins });

  await app.register(healthRoutes);
  await app.register(authRoutes, { saasFetch: opts.saasFetch });
  await app.register(catalogRoutes);
  await app.register(paramInterfaceRoutes);
  await app.register(reportNameRoutes);
  await app.register(reportNameInterfaceRoutes);
  await app.register(technicalRequirementRoutes);
  await app.register(calculationMethodRoutes);
  await app.register(calcRoutes);
  return app;
}
