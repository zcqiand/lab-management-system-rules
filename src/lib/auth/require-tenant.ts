// requireTenant — rules 服务统一租户身份入口。
//
// 语义镜像 nextjs src/lib/auth/require-tenant.ts：租户身份只来自
// Authorization Bearer JWT 的 tenant_id claim，缺失即 401，禁 demo 字面量
// 兜底（ADR-0019）。401 信封逐字面（与 nextjs / contracts POST 一致）。
import type { LabJwtSigner } from "./jwt.js";

export type TenantAuth =
  { tenantId: string } | { statusCode: 401; body: { code: string; message: string } };

const UNAUTHORIZED_401 = (): Extract<TenantAuth, { statusCode: 401 }> => ({
  statusCode: 401,
  body: { code: "UNAUTHORIZED", message: "tenant_id claim is required (ADR-0019)" },
});

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

/** 解 Bearer JWT 的 tenant_id claim → { tenantId }；否则 401（调用方 reply.code(401).send(body) 短路）。 */
export async function requireTenant(
  authorization: string | undefined,
  signer: LabJwtSigner,
): Promise<TenantAuth> {
  const token = bearerToken(authorization);
  if (!token) return UNAUTHORIZED_401();
  try {
    const claims = await signer.verify(token);
    if (!claims.tenant_id) return UNAUTHORIZED_401();
    return { tenantId: claims.tenant_id };
  } catch {
    return UNAUTHORIZED_401();
  }
}
