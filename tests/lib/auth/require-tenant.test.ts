import { describe, expect, it } from "vitest";
import { LabJwtSigner } from "@/lib/auth/jwt.js";
import { requireTenant } from "@/lib/auth/require-tenant.js";

// 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
const SECRET = "rules-test-secret-0123456789abcdef-32bytes!";
const signer = new LabJwtSigner(SECRET, "lab-rules-test", 3600);

const ENVELOPE = {
  code: "UNAUTHORIZED",
  message: "tenant_id claim is required (ADR-0019)",
};

describe("requireTenant", () => {
  it("无 Authorization → 401 信封逐字面", async () => {
    const r = await requireTenant(undefined, signer);
    expect(r).toMatchObject({ statusCode: 401, body: ENVELOPE });
  });

  it("Bearer 无 tenant_id claim → 同信封", async () => {
    const token = await signer.issue("user-1", null);
    const r = await requireTenant(`Bearer ${token}`, signer);
    expect(r).toMatchObject({ statusCode: 401, body: ENVELOPE });
  });

  it("Bearer 带 tenant_id claim → 放行 { tenantId }", async () => {
    const token = await signer.issue("user-1", "tenant-A");
    const r = await requireTenant(`Bearer ${token}`, signer);
    expect(r).toEqual({ tenantId: "tenant-A" });
  });
});
