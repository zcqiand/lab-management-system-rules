import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fnTest } from "../fn.js";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import { inspectionTechnicalRequirements } from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// fn: M06.F06.I01-I05 技术要求域（Task 9）
// 数据面：lab_test 真库；FK 前三键用种子现行行 OBJ-SP01-P1 / IP-0001 / GB18242-2008。
// 3 键路径语义 = '' 哨兵精确命中（Task 9 Ruling，逐字面镜像 nextjs getTechReqDb）：
// 变体列全 '' 才算命中，变体行不入三键寻址；DELETE 只删哨兵行（变体族保留）。
// DELETE 幂等 204（plan R2 裁定，非 nextjs missing→404——CT 容 200/204）。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };

const OBJ = "OBJ-SP01-P1";
const PARAM = "IP-0001";
const STD = "GB18242-2008";
const PATH3 = `/api/technical-requirements/${OBJ}/${PARAM}/${STD}`;

function sentinelWhere() {
  return and(
    eq(inspectionTechnicalRequirements.inspectionObjectCode, OBJ),
    eq(inspectionTechnicalRequirements.inspectionParameterCode, PARAM),
    eq(inspectionTechnicalRequirements.judgmentStandardCode, STD),
  );
}

async function cleanupAll() {
  await db.delete(inspectionTechnicalRequirements).where(sentinelWhere());
}

beforeAll(async () => {
  await cleanupAll();
});

afterAll(async () => {
  await cleanupAll();
  await app.close();
});

describe("POST /api/technical-requirements", () => {
  fnTest(
    ["M06.F06.I03"],
    "create→201 + 缺省 numeric/manual/draft/sortOrder 0",
    async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/technical-requirements",
        headers: authz,
        payload: {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          judgmentStandardCode: STD,
          comparison: "≥",
          minValue: "1.0",
          maxValue: "10.0",
          unit: "MPa",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.valueType).toBe("numeric");
      expect(body.judgmentMode).toBe("manual");
      expect(body.verificationStatus).toBe("draft");
      expect(body.sortOrder).toBe(0);
      expect(body.id).toBe(`tr-${OBJ}-${PARAM}-${STD}`);
      // 缺 comparison → 400 指名（R6-2 fail-fast）
      const noCmp = await app.inject({
        method: "POST",
        url: "/api/technical-requirements",
        headers: authz,
        payload: {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          judgmentStandardCode: STD,
        },
      });
      expect(noCmp.statusCode).toBe(400);
      expect(noCmp.json().code).toBe("VALIDATION_ERROR");
      // dup 8 键 → 400「已存在」
      const dup = await app.inject({
        method: "POST",
        url: "/api/technical-requirements",
        headers: authz,
        payload: {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          judgmentStandardCode: STD,
          comparison: "≥",
        },
      });
      expect(dup.statusCode).toBe(400);
      expect(dup.json().message).toContain("技术要求已存在");
    },
  );

  fnTest(["M06.F06.I03"], "body 不带 brand → DB 行 brand=''（'' 哨兵缺省）", async () => {
    try {
      const rows = await db
        .select()
        .from(inspectionTechnicalRequirements)
        .where(sentinelWhere());
      expect(rows).toHaveLength(1);
      expect(rows[0]!.brand).toBe("");
      expect(rows[0]!.model).toBe("");
      expect(rows[0]!.sieve).toBe("");
    } finally {
      await cleanupAll();
    }
  });
});

describe("GET /api/technical-requirements（list 裸数组）", () => {
  fnTest(["M06.F06.I01"], "裸数组非 Page 包 + 三键过滤 + 派生 id", async () => {
    await db.insert(inspectionTechnicalRequirements).values({
      inspectionObjectCode: OBJ,
      inspectionParameterCode: PARAM,
      judgmentStandardCode: STD,
      comparison: "≤",
      brand: "R2-LIST-B",
      sortOrder: 7,
    });
    try {
      const qs =
        "?inspectionObjectCode=" +
        OBJ +
        "&inspectionParameterCode=" +
        PARAM +
        "&judgmentStandardCode=" +
        STD;
      const res = await app.inject({
        method: "GET",
        url: "/api/technical-requirements" + qs,
        headers: authz,
      });
      expect(res.statusCode).toBe(200);
      const items = res.json();
      expect(Array.isArray(items)).toBe(true);
      const mine = items.filter(
        (r: { inspectionObjectCode: string }) => r.inspectionObjectCode === OBJ,
      );
      expect(mine.length).toBeGreaterThanOrEqual(1);
      for (const r of mine) {
        expect(r.id).toBe(
          "tr-" +
            r.inspectionObjectCode +
            "-" +
            r.inspectionParameterCode +
            "-" +
            r.judgmentStandardCode,
        );
      }
    } finally {
      await db
        .delete(inspectionTechnicalRequirements)
        .where(eq(inspectionTechnicalRequirements.brand, "R2-LIST-B"));
    }
  });
});

describe("GET/PUT/DELETE /api/technical-requirements/{obj}/{param}/{std}", () => {
  fnTest(
    ["M06.F06.I02"],
    "同 3 键哨兵+变体行 → 路径返回 '' 哨兵行（Ruling：非 sortOrder 首个）",
    async () => {
      // 哨兵行 sortOrder=2，brand 变体行 sortOrder=1——若实现取 sortOrder 首个
      // 会返回 brand 行，此断言即红；'' 哨兵语义下恒返回哨兵行。
      await db.insert(inspectionTechnicalRequirements).values([
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          judgmentStandardCode: STD,
          comparison: "≥",
          sortOrder: 2,
        },
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          judgmentStandardCode: STD,
          comparison: "≥",
          brand: "R2-BRAND-LOW",
          sortOrder: 1,
        },
      ]);
      try {
        const res = await app.inject({ method: "GET", url: PATH3, headers: authz });
        expect(res.statusCode).toBe(200);
        expect(res.json().brand).toBe("");
        expect(res.json().id).toBe(`tr-${OBJ}-${PARAM}-${STD}`);
        const miss = await app.inject({
          method: "GET",
          url: `/api/technical-requirements/${OBJ}/${PARAM}/R2-STD-MISSING`,
          headers: authz,
        });
        expect(miss.statusCode).toBe(404);
        expect(miss.json().code).toBe("NOT_FOUND");
        expect(miss.json().message).toBe("TechnicalRequirement not found");
      } finally {
        await cleanupAll();
      }
    },
  );

  fnTest(
    ["M06.F06.I04"],
    "PUT PATCH 语义：改 unit 保哨兵身份；PK 键不可 patch",
    async () => {
      await db.insert(inspectionTechnicalRequirements).values({
        inspectionObjectCode: OBJ,
        inspectionParameterCode: PARAM,
        judgmentStandardCode: STD,
        comparison: "≥",
        unit: "MPa",
      });
      try {
        const res = await app.inject({
          method: "PUT",
          url: PATH3,
          headers: authz,
          payload: { unit: "kN", brand: "SHOULD-NOT-CHANGE" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().unit).toBe("kN");
        const rows = await db
          .select()
          .from(inspectionTechnicalRequirements)
          .where(sentinelWhere());
        expect(rows).toHaveLength(1);
        expect(rows[0]!.brand).toBe("");
      } finally {
        await cleanupAll();
      }
    },
  );

  fnTest(["M06.F06.I05"], "DELETE→204 幂等；变体族保留（只删哨兵行）", async () => {
    await db.insert(inspectionTechnicalRequirements).values([
      {
        inspectionObjectCode: OBJ,
        inspectionParameterCode: PARAM,
        judgmentStandardCode: STD,
        comparison: "≥",
      },
      {
        inspectionObjectCode: OBJ,
        inspectionParameterCode: PARAM,
        judgmentStandardCode: STD,
        comparison: "≥",
        brand: "R2-BRAND-KEEP",
      },
    ]);
    try {
      const res = await app.inject({ method: "DELETE", url: PATH3, headers: authz });
      expect(res.statusCode).toBe(204);
      const again = await app.inject({ method: "DELETE", url: PATH3, headers: authz });
      expect(again.statusCode).toBe(204);
      const rows = await db
        .select()
        .from(inspectionTechnicalRequirements)
        .where(sentinelWhere());
      expect(rows).toHaveLength(1);
      expect(rows[0]!.brand).toBe("R2-BRAND-KEEP");
    } finally {
      await cleanupAll();
    }
  });
});

describe("401 全域", () => {
  // 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
  it("无 token → UNAUTHORIZED 信封逐字面", async () => {
    const res = await app.inject({ method: "GET", url: "/api/technical-requirements" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "tenant_id claim is required (ADR-0019)",
    });
  });
});
