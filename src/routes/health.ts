import type { FastifyPluginAsync } from "fastify";

/** 健康探针（家族契约 GET /healthz → {"ok":true}）。 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => ({ ok: true }));
};
