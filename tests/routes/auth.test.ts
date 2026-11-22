import { describe, expect } from "vitest";
import { fnTest } from "../fn.js";
import { buildApp } from "@/app.js";
import type { SaasFetch } from "@/lib/auth/saas-client.js";

// fn: M01.F05.I01（login）+ M00.F01.I01（me）R2 最小面（Task 4）
const okSaas =
  (body: object): SaasFetch =>
  async () =>
    new Response(JSON.stringify(body), { status: 200 });

const aliceSaas = {
  userId: "saas-user-1",
  accessToken: "saas-access-token",
  user: { id: "saas-user-1", username: "alice", displayName: "Alice" },
  currentTenantId: "tenant-uuid-1",
  availableTenants: [
    { tenantId: "tenant-uuid-1", roleIds: ["admin"], status: "active" },
    { tenantId: "tenant-uuid-2", roleIds: ["member"], status: "active" },
    { tenantId: "tenant-uuid-3", roleIds: ["member"], status: "removed" },
  ],
};

async function login(
  app: ReturnType<typeof buildApp> extends Promise<infer T> ? T : never,
  body: object,
) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: body });
}

describe("POST /api/auth/login", () => {
  fnTest(
    ["M01.F05.I01"],
    "saas 200 → 200，token 可 verify 出 tenant_id claim，tenants 过滤 removed",
    async () => {
      const app = await buildApp({ saasFetch: okSaas(aliceSaas) });
      const res = await login(app, { username: "alice", password: "dev123456" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.username).toBe("alice");
      expect(body.user.displayName).toBe("Alice");
      expect(body.tenants).toHaveLength(2);
      expect(body.tenants[0].tenantId).toBe("tenant-uuid-1");
      const claims = await app.labJwt.verify(body.token);
      expect(claims.tenant_id).toBe("tenant-uuid-1");
      expect(claims.sub).toBe("saas-user-1");
      await app.close();
    },
  );

  fnTest(["M01.F05.I01"], "缺 username/password → 400 BAD_REQUEST", async () => {
    const app = await buildApp({ saasFetch: okSaas(aliceSaas) });
    const res = await login(app, { username: "alice" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      code: "BAD_REQUEST",
      message: "username and password are required",
    });
    await app.close();
  });

  fnTest(["M01.F05.I01"], "saas 401 → 401 INVALID_CREDENTIALS 逐字面", async () => {
    const app = await buildApp({
      saasFetch: async () => new Response("{}", { status: 401 }),
    });
    const res = await login(app, { username: "alice", password: "wrong" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    });
    await app.close();
  });

  fnTest(["M01.F05.I01"], "saas 网络错 → 502 SAAS_UNAVAILABLE 逐字面", async () => {
    const app = await buildApp({
      saasFetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const res = await login(app, { username: "alice", password: "x" });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      code: "SAAS_UNAVAILABLE",
      message: "saas IdP unavailable",
    });
    await app.close();
  });
});

describe("GET /api/auth/me", () => {
  fnTest(["M00.F01.I01"], "无 token → 401 Bearer 信封逐字面（ADR-0019）", async () => {
    const app = await buildApp({ saasFetch: okSaas(aliceSaas) });
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "Bearer token required (ADR-0019)",
    });
    await app.close();
  });

  fnTest(
    ["M00.F01.I01"],
    "login 后 me → CurrentUserSession 形状（user/tenants/currentTenantId）",
    async () => {
      const app = await buildApp({ saasFetch: okSaas(aliceSaas) });
      const loginRes = await login(app, { username: "alice", password: "dev123456" });
      const token = loginRes.json().token;
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.username).toBe("alice");
      expect(body.tenants).toHaveLength(2);
      expect(body.tenants[0].code).toBe("tenant-uuid-1");
      expect(body.currentTenantId).toBe("tenant-uuid-1");
      await app.close();
    },
  );
});
