import Fastify, { type FastifyInstance } from "fastify";
import { healthRoutes } from "./routes/health.js";

/**
 * 纯装配：注册路由，不 listen。测试与 server.ts 共用。
 * 各域路由（R2 起五域 + calc）一律挂在这里，禁散落启动面。
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  return app;
}
