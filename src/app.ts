import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { requireEnv } from "./lib/env-required.js";
import { LabJwtSigner } from "./lib/auth/jwt.js";

declare module "fastify" {
  interface FastifyInstance {
    labJwt: LabJwtSigner;
  }
}

/**
 * 纯装配：注册路由，不 listen。测试与 server.ts 共用。
 * 各域路由（R2 起五域 + calc）一律挂在这里，禁散落启动面。
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

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
  return app;
}
