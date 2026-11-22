import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fnTest } from "../fn.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  inspectionReportNames,
  inspectionObjectReportNames,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
} from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// fn: M06.F07.I01-I08 + M06.F04.I05-I07 报告名称域（Task 7）
// 数据面：lab_test 真库；自建 unique 行 + 收尾清理。
// links FK：OBJ-SP01-P1（对象）/ GB18242-2008（标准）/ IP-0001（参数）均种子现行行。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };

const CODES = ["R2-RN-A", "R2-RN-B", "R2-RN-C"];
const CLEANUP_CODES = [...CODES, "R2-RN-NEW"];
const OBJ = "OBJ-SP01-P1";
const STD = "GB18242-2008";
const PARAM = "IP-0001";

async function cleanup() {
  for (const code of CLEANUP_CODES) {
    await db
      .delete(inspectionObjectReportNames)
      .where(eq(inspectionObjectReportNames.reportNameCode, code));
    await db
      .delete(inspectionReportNameStandards)
      .where(eq(inspectionReportNameStandards.reportNameCode, code));
    await db
      .delete(inspectionReportNameParameters)
      .where(eq(inspectionReportNameParameters.reportNameCode, code));
    await db.delete(inspectionReportNames).where(eq(inspectionReportNames.code, code));
  }
}

beforeAll(async () => {
  await cleanup();
  for (const [i, code] of CODES.entries()) {
    await db.insert(inspectionReportNames).values({
      code,
      name: `R2 报告名称 ${i + 1}`,
      sortOrder: 9000 + i,
    });
  }
});

afterAll(async () => {
  await cleanup();
  await app.close();
});

describe("GET /api/report-names", () => {
  fnTest(["M06.F07.I01"], "list 回显不切片 + keyword code/name 双匹配", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/report-names?page=1&pageSize=1&keyword=R2-RN",
      headers: authz,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
    const mine = body.items.filter((r: { code: string }) => CODES.includes(r.code));
    expect(mine).toHaveLength(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    const byName = await app.inject({
      method: "GET",
      url: "/api/report-names?keyword=" + encodeURIComponent("报告名称 2"),
      headers: authz,
    });
    expect(byName.statusCode).toBe(200);
    const named = byName.json().items as Array<{ code: string; name: string }>;
    expect(named.some((r) => r.code === "R2-RN-B")).toBe(true);
    expect(named.every((r) => r.name.includes("报告名称 2"))).toBe(true);
  });
});

describe("POST /api/report-names", () => {
  fnTest(["M06.F07.I03"], "code/name 必填；dup → 400", async () => {
    const noName = await app.inject({
      method: "POST",
      url: "/api/report-names",
      headers: authz,
      payload: { code: "R2-RN-NEW" },
    });
    expect(noName.statusCode).toBe(400);
    expect(noName.json().code).toBe("BAD_REQUEST");
    const res = await app.inject({
      method: "POST",
      url: "/api/report-names",
      headers: authz,
      payload: { code: "R2-RN-NEW", name: "R2 新报告名称" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("R2-RN-NEW");
    const dup = await app.inject({
      method: "POST",
      url: "/api/report-names",
      headers: authz,
      payload: { code: "R2-RN-NEW", name: "重复" },
    });
    expect(dup.statusCode).toBe(400);
  });
});

describe("GET/PUT/DELETE /api/report-names/{code}", () => {
  fnTest(["M06.F07.I02"], "详情；missing → 404 NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/report-names/R2-RN-A",
      headers: authz,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toBe("R2-RN-A");
    const miss = await app.inject({
      method: "GET",
      url: "/api/report-names/R2-RN-MISSING",
      headers: authz,
    });
    expect(miss.statusCode).toBe(404);
    expect(miss.json().code).toBe("NOT_FOUND");
  });

  fnTest(["M06.F07.I04"], "PUT PATCH 语义：改 name 保留 sortOrder", async () => {
    const pre = await app.inject({
      method: "GET",
      url: "/api/report-names/R2-RN-A",
      headers: authz,
    });
    const sortOrder = pre.json().sortOrder;
    const res = await app.inject({
      method: "PUT",
      url: "/api/report-names/R2-RN-A",
      headers: authz,
      payload: { name: "R2 改名报告" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("R2 改名报告");
    expect(res.json().sortOrder).toBe(sortOrder);
  });

  fnTest(["M06.F07.I05"], "DELETE → 204 幂等", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/report-names/R2-RN-C",
      headers: authz,
    });
    expect(res.statusCode).toBe(204);
    const again = await app.inject({
      method: "DELETE",
      url: "/api/report-names/R2-RN-C",
      headers: authz,
    });
    expect(again.statusCode).toBe(204);
  });
});

describe("links 三族", () => {
  fnTest(["M06.F07.I06", "M06.F04.I05"], "object link/unlink 204 幂等往返", async () => {
    const payload = { inspectionObjectCode: OBJ, reportNameCode: "R2-RN-A" };
    const r1 = await app.inject({
      method: "POST",
      url: "/api/report-names/links/object",
      headers: authz,
      payload,
    });
    expect(r1.statusCode).toBe(204);
    const r2 = await app.inject({
      method: "POST",
      url: "/api/report-names/links/object",
      headers: authz,
      payload,
    });
    expect(r2.statusCode).toBe(204);
    const list = await app.inject({
      method: "GET",
      url: `/api/report-names/links/object?reportNameCode=R2-RN-A`,
      headers: authz,
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{ inspectionObjectCode: string }>;
    expect(items.some((r) => r.inspectionObjectCode === OBJ)).toBe(true);
    const del = await app.inject({
      method: "DELETE",
      url: "/api/report-names/links/object",
      headers: authz,
      payload,
    });
    expect(del.statusCode).toBe(204);
    const delAgain = await app.inject({
      method: "DELETE",
      url: "/api/report-names/links/object",
      headers: authz,
      payload,
    });
    expect(delAgain.statusCode).toBe(204);
  });

  fnTest(
    ["M06.F07.I07", "M06.F04.I07"],
    "standard link/unlink 204 幂等（role 入 PK）",
    async () => {
      const payload = {
        reportNameCode: "R2-RN-A",
        inspectionStandardCode: STD,
        role: "TESTING",
      };
      const r1 = await app.inject({
        method: "POST",
        url: "/api/report-names/links/standard",
        headers: authz,
        payload,
      });
      expect(r1.statusCode).toBe(204);
      const r2 = await app.inject({
        method: "POST",
        url: "/api/report-names/links/standard",
        headers: authz,
        payload,
      });
      expect(r2.statusCode).toBe(204);
      const del = await app.inject({
        method: "DELETE",
        url: "/api/report-names/links/standard",
        headers: authz,
        payload,
      });
      expect(del.statusCode).toBe(204);
      const delAgain = await app.inject({
        method: "DELETE",
        url: "/api/report-names/links/standard",
        headers: authz,
        payload,
      });
      expect(delAgain.statusCode).toBe(204);
    },
  );

  fnTest(["M06.F07.I08", "M06.F04.I06"], "parameter link/unlink 204 幂等", async () => {
    const payload = { reportNameCode: "R2-RN-A", inspectionParameterCode: PARAM };
    const r1 = await app.inject({
      method: "POST",
      url: "/api/report-names/links/parameter",
      headers: authz,
      payload,
    });
    expect(r1.statusCode).toBe(204);
    const r2 = await app.inject({
      method: "POST",
      url: "/api/report-names/links/parameter",
      headers: authz,
      payload,
    });
    expect(r2.statusCode).toBe(204);
    const del = await app.inject({
      method: "DELETE",
      url: "/api/report-names/links/parameter",
      headers: authz,
      payload,
    });
    expect(del.statusCode).toBe(204);
    const delAgain = await app.inject({
      method: "DELETE",
      url: "/api/report-names/links/parameter",
      headers: authz,
      payload,
    });
    expect(delAgain.statusCode).toBe(204);
  });
});

describe("401 全域", () => {
  // 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
  it("无 token → UNAUTHORIZED 信封逐字面", async () => {
    const res = await app.inject({ method: "GET", url: "/api/report-names" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "tenant_id claim is required (ADR-0019)",
    });
  });
});
