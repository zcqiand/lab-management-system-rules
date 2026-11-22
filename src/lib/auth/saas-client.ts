// saas-client — saas IdP 代理登录薄客户端（REQ-2026-023 形态）。
// 账密校验真源=saas；本仓只做转发+错误映射：
//   saas 4xx → invalid；5xx/不可达/超时 → unavailable。
// R2 最小面：只密码登录通道；serviceLogin 菜单快照 / admin/tenants 富化挂账 R3+。
import { requireEnv } from "../env-required.js";

export type SaasFetch = (url: string, init: RequestInit) => Promise<Response>;

export type SaasProxyResult =
  { kind: "ok"; body: SaasLoginBody } | { kind: "invalid" } | { kind: "unavailable" };

export interface SaasLoginBody {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id?: string; username?: string; email?: string; displayName?: string };
  currentTenantId?: string | null;
  availableTenants?: Array<{
    tenantId?: string;
    roleIds?: string[];
    status?: string;
  }>;
}

export interface SaasClient {
  proxyLogin(username: string, password: string): Promise<SaasProxyResult>;
}

export function createSaasClient(fetchImpl: SaasFetch = fetch): SaasClient {
  return {
    async proxyLogin(username, password) {
      const base = requireEnv("SAAS_IDP_URL").replace(/\/$/, "");
      const clientId = requireEnv("LAB_SAAS_CLIENT_ID");
      try {
        const resp = await fetchImpl(`${base}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password, clientId }),
        });
        if (resp.status >= 400 && resp.status < 500) return { kind: "invalid" };
        if (!resp.ok) return { kind: "unavailable" };
        const body = (await resp.json().catch(() => ({}))) as SaasLoginBody;
        return { kind: "ok", body };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}
