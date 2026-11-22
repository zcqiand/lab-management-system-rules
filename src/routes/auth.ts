// M01.F05.I01 login（saas 代理）+ M00.F01.I01 me — R2 auth 最小面。
// 语义镜像 nextjs src/app/api/auth/login/route.ts 与 me/route.ts（REQ-2026-023）：
//   login = 账密转发 saas /api/v1/auth/login（clientId=LAB_SAAS_CLIENT_ID）→
//           lab 自签 JWT（不透传 saas token）→ 写 user/membership 快照。
//   me    = bearer 解 payload（不验签，镜像 nextjs bearer.ts）读快照；
//           miss 一律 401 可恢复态，禁 demo 兜底（ADR-0019）。
// R2 裁量：refresh / switch-tenant / sso / menus / permissions / native-login
// / logout 共 8 op 挂账 R3+（alignment declared_gap）。
import type { FastifyInstance, FastifyReply } from "fastify";
import type { SaasFetch } from "../lib/auth/saas-client.js";
import { createSaasClient } from "../lib/auth/saas-client.js";
import {
  getMembershipSnapshot,
  getUserSnapshot,
  putMembershipSnapshot,
  putUserSnapshot,
  type SnapshotTenant,
} from "../lib/auth/snapshot.js";

const json = (reply: FastifyReply, status: number, body: object) =>
  reply.code(status).send(body);

function bearerClaim(
  authz: string | undefined,
  pick: (payload: { sub?: string; tenant_id?: string }) => string | null,
): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const parts = authz.slice("Bearer ".length).split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
      tenant_id?: string;
    };
    return pick(payload);
  } catch {
    return null;
  }
}

export async function authRoutes(
  app: FastifyInstance,
  opts: { saasFetch?: SaasFetch } = {},
): Promise<void> {
  const saas = createSaasClient(opts.saasFetch ?? fetch);
  const signer = app.labJwt;

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { username?: string; password?: string };
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return json(reply, 400, {
        code: "BAD_REQUEST",
        message: "username and password are required",
      });
    }

    const proxy = await saas.proxyLogin(username, password);
    if (proxy.kind === "invalid") {
      return json(reply, 401, {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password",
      });
    }
    if (proxy.kind === "unavailable") {
      return json(reply, 502, {
        code: "SAAS_UNAVAILABLE",
        message: "saas IdP unavailable",
      });
    }
    const saasLogin = proxy.body;

    // R2 最小面：无 admin/tenants 富化（tenant_key 解析挂账 R3+）——
    // name/code 降级 tenantId 原值（nextjs best-effort 失败分支同形状）。
    const tenants: SnapshotTenant[] = (saasLogin.availableTenants ?? [])
      .filter(
        (t): t is { tenantId: string; roleIds?: string[]; status?: string } =>
          !!t.tenantId && t.status !== "removed",
      )
      .map((t) => ({
        tenantId: t.tenantId,
        code: t.tenantId,
        name: t.tenantId,
        roleIds: t.roleIds ?? [],
      }));

    // 回退链用 ||（saas user 无 displayName 且空串 falsy，?? 拦不住——记忆陷阱）
    const saasUser = saasLogin.user ?? {};
    const user = {
      id: saasUser.id || saasLogin.userId || "unknown",
      username: saasUser.username || saasUser.email || "unknown",
      displayName:
        saasUser.displayName || saasUser.username || saasUser.email || "未知用户",
      roleCode: tenants[0]?.roleIds?.[0] || "member",
    };

    const currentTenantId = saasLogin.currentTenantId ?? tenants[0]?.tenantId ?? null;

    putUserSnapshot(user.id, user);
    putMembershipSnapshot(user.id, tenants);

    return json(reply, 200, {
      token: await signer.issue(user.id, currentTenantId),
      user,
      tenants,
    });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const authz = req.headers.authorization;
    const sub = bearerClaim(authz, (p) => p.sub ?? null);
    if (sub === null) {
      return json(reply, 401, {
        code: "UNAUTHORIZED",
        message: "Bearer token required (ADR-0019)",
      });
    }
    const user = getUserSnapshot(sub);
    if (!user) {
      return json(reply, 401, {
        code: "USER_UNAVAILABLE",
        message: `user snapshot unavailable for user ${sub}; re-login to recover`,
      });
    }
    const tenants = getMembershipSnapshot(sub);
    if (!tenants) {
      return json(reply, 401, {
        code: "MEMBERSHIP_UNAVAILABLE",
        message: `membership snapshot unavailable for user ${sub}; refresh to recover`,
      });
    }
    return json(reply, 200, {
      user,
      tenants,
      currentTenantId:
        bearerClaim(authz, (p) => p.tenant_id ?? null) ?? tenants[0]?.tenantId ?? "",
    });
  });
}
