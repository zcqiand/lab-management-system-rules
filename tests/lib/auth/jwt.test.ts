import { describe, expect } from "vitest";
import { fnTest } from "../../fn.js";
import { LabJwtSigner } from "@/lib/auth/jwt.js";

const SECRET = "rules-test-secret-0123456789abcdef-32bytes!";
const ISSUER = "lab-rules-test";

function unsignedAlgNoneToken(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o), "utf8").toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`;
}

describe("LabJwtSigner", () => {
  fnTest(["M01.F05.I06"], "issue→verify 往返 claim 全等（含 tenant_id）", async () => {
    const signer = new LabJwtSigner(SECRET, ISSUER, 3600);
    const token = await signer.issue("user-1", "tenant-A");
    const claims = await signer.verify(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.tenant_id).toBe("tenant-A");
    expect(claims.iss).toBe(ISSUER);
    expect(claims.typ).toBe("access");
    expect(typeof claims.iat).toBe("number");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  fnTest(["M01.F05.I06"], "tenantId=null 时不带 tenant_id claim", async () => {
    const signer = new LabJwtSigner(SECRET, ISSUER, 3600);
    const claims = await signer.verify(await signer.issue("user-1", null));
    expect(claims.tenant_id).toBeUndefined();
  });

  fnTest(["M01.F05.I06"], "过期 token verify 抛错", async () => {
    const signer = new LabJwtSigner(SECRET, ISSUER, -1);
    const token = await signer.issue("user-1", null);
    await expect(signer.verify(token)).rejects.toThrow();
  });

  fnTest(["M01.F05.I06"], "alg=none token 拒绝", async () => {
    const signer = new LabJwtSigner(SECRET, ISSUER, 3600);
    const token = unsignedAlgNoneToken({
      sub: "user-1",
      iss: ISSUER,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await expect(signer.verify(token)).rejects.toThrow();
  });

  fnTest(["M01.F05.I06"], "短密钥构造 throw（≥32 字节 fail-fast）", () => {
    expect(() => new LabJwtSigner("short", ISSUER, 3600)).toThrow(/32/);
  });
});
