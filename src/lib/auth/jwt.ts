// M01.F05.I06 — LabJwtSigner（jose HS256 版）。
//
// 语义镜像 nextjs src/lib/auth/jwt.ts（node:crypto 同步实现）：
// - claim { sub, iat, exp, typ, iss, tenant_id? }
// - alg 固定 HS256（alg=none / 改 alg 一律拒绝——jose 按给定 key 校验 alg）
// - verify 同步恒等 + iss + exp 校验
//
// 差异（jose 无同步验签面）：verify 为 async。refresh token 面不在 R2
// 范围（挂账 R3+），构造器省 refreshTtlSeconds。
import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const TYP_ACCESS = "access";
const MIN_SECRET_BYTES = 32;

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  typ: string;
  iss: string;
  tenant_id?: string;
  [claim: string]: unknown;
}

export class LabJwtSigner {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly accessTtlSeconds: number;

  constructor(secret: string, issuer: string, accessTtlSeconds: number) {
    if (!secret) {
      throw new Error("LAB_JWT_SECRET required (>=32 bytes). Set via env var or config.");
    }
    if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
      throw new Error(
        `LAB_JWT_SECRET must be >=${MIN_SECRET_BYTES} bytes (got ${Buffer.byteLength(secret, "utf8")}). Use openssl rand -base64 48.`,
      );
    }
    if (!issuer) {
      throw new Error("lab.jwt.issuer required");
    }
    this.secret = new TextEncoder().encode(secret);
    this.issuer = issuer;
    this.accessTtlSeconds = accessTtlSeconds;
  }

  /** Access token。tenantId 可空。 */
  issue(userId: string, tenantId: string | null): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = { typ: TYP_ACCESS };
    if (tenantId) claims.tenant_id = tenantId;
    return new SignJWT(claims)
      .setProtectedHeader({ alg: ALG, typ: "JWT" })
      .setSubject(userId)
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTtlSeconds)
      .setIssuer(this.issuer)
      .sign(this.secret);
  }

  /** 验签 + iss + exp 校验（jose jwtVerify 一并做 alg/签名/exp；iss 显式对拍）。失败抛错。 */
  async verify(token: string): Promise<JwtClaims> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: this.issuer,
      algorithms: [ALG],
    });
    return payload as JwtClaims;
  }
}
