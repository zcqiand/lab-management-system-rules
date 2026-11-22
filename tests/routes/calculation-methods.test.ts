import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fnTest } from "../fn.js";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client.js";
import { inspectionCalculationMethods } from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// fn: M06.F05.I01-I05 计算方法域（Task 10）
// 数据面：lab_test 真库；FK 用种子现行行 OBJ-SP01-P1 / IP-0005 / 两标准码。
// 2 键路径语义 = testingStandardCode 升序首个（R6-1 已人裁，镜像 nextjs
// getCalcMethodDb/updateCalcMethodDb）；DELETE 删该 obj+param 全部 standard 行
// （nextjs 同款）且 missing→404（nextjs 逐字面，终审 I-1 修正）。
// wire 缺省 algorithmType="manual"（照 nextjs 路由实际行为；DB default 同值）。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };

const OBJ = "OBJ-SP01-P1";
const PARAM = "IP-0005";
const STD_A = "GB 13788-2024";
const STD_B = "GB 1499.1-2024";
const PATH2 = `/api/calculation-methods/${OBJ}/${PARAM}`;

async function cleanupAll() {
  await db
    .delete(inspectionCalculationMethods)
    .where(
      and(
        eq(inspectionCalculationMethods.inspectionObjectCode, OBJ),
        eq(inspectionCalculationMethods.inspectionParameterCode, PARAM),
        inArray(inspectionCalculationMethods.testingStandardCode, [STD_A, STD_B]),
      ),
    );
}

beforeAll(async () => {
  await cleanupAll();
});

afterAll(async () => {
  await cleanupAll();
  await app.close();
});

describe("GET /api/calculation-methods/{obj}/{param}（2 键路径）", () => {
  fnTest(
    ["M06.F05.I02"],
    "同 obj+param 两行 → 返回 testingStandardCode 升序首个（R6-1）",
    async () => {
      await db.insert(inspectionCalculationMethods).values([
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          testingStandardCode: STD_B,
          remark: "R2-second",
        },
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          testingStandardCode: STD_A,
          remark: "R2-first",
        },
      ]);
      try {
        const res = await app.inject({ method: "GET", url: PATH2, headers: authz });
        expect(res.statusCode).toBe(200);
        expect(res.json().testingStandardCode).toBe(STD_A);
        expect(res.json().remark).toBe("R2-first");
        expect(res.json().id).toBe(`cr-${OBJ}-${PARAM}`);
        const miss = await app.inject({
          method: "GET",
          url: `/api/calculation-methods/${OBJ}/R2-PARAM-MISSING`,
          headers: authz,
        });
        expect(miss.statusCode).toBe(404);
        expect(miss.json().code).toBe("NOT_FOUND");
        expect(miss.json().message).toBe("CalculationMethod not found");
      } finally {
        await cleanupAll();
      }
    },
  );
});

describe("GET /api/calculation-methods（list 裸数组）", () => {
  fnTest(["M06.F05.I01"], "裸数组 + 双键过滤 + 派生 id", async () => {
    await db.insert(inspectionCalculationMethods).values({
      inspectionObjectCode: OBJ,
      inspectionParameterCode: PARAM,
      testingStandardCode: STD_A,
      remark: "R2-list",
    });
    try {
      const res = await app.inject({
        method: "GET",
        url:
          `/api/calculation-methods?inspectionObjectCode=${OBJ}` +
          `&inspectionParameterCode=${PARAM}`,
        headers: authz,
      });
      expect(res.statusCode).toBe(200);
      const items = res.json();
      expect(Array.isArray(items)).toBe(true);
      const mine = items.filter((r: { remark: string }) => r.remark === "R2-list");
      expect(mine).toHaveLength(1);
      expect(mine[0]!.id).toBe(`cr-${OBJ}-${PARAM}`);
    } finally {
      await cleanupAll();
    }
  });
});

describe("POST /api/calculation-methods", () => {
  fnTest(
    ["M06.F05.I03"],
    "create→201 + 缺省 manual/sortOrder 0；缺 std→400 指名；dup→400 已存在",
    async () => {
      try {
        const res = await app.inject({
          method: "POST",
          url: "/api/calculation-methods",
          headers: authz,
          payload: {
            inspectionObjectCode: OBJ,
            inspectionParameterCode: PARAM,
            testingStandardCode: STD_A,
            formula: "x * 1.0",
          },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.algorithmType).toBe("manual");
        expect(body.sortOrder).toBe(0);
        expect(body.id).toBe(`cr-${OBJ}-${PARAM}`);
        // 缺 testingStandardCode → 400 指名（R6-2 fail-fast）
        const noStd = await app.inject({
          method: "POST",
          url: "/api/calculation-methods",
          headers: authz,
          payload: {
            inspectionObjectCode: OBJ,
            inspectionParameterCode: PARAM,
          },
        });
        expect(noStd.statusCode).toBe(400);
        expect(noStd.json().code).toBe("VALIDATION_ERROR");
        expect(noStd.json().message).toContain("必填");
        // dup 3 键 → 400「已存在」
        const dup = await app.inject({
          method: "POST",
          url: "/api/calculation-methods",
          headers: authz,
          payload: {
            inspectionObjectCode: OBJ,
            inspectionParameterCode: PARAM,
            testingStandardCode: STD_A,
          },
        });
        expect(dup.statusCode).toBe(400);
        expect(dup.json().message).toContain("计算方法已存在");
      } finally {
        await cleanupAll();
      }
    },
  );
});

describe("PUT /api/calculation-methods/{obj}/{param}", () => {
  fnTest(["M06.F05.I04"], "PATCH 语义作用于首个行；PK 三键不可 patch", async () => {
    await db.insert(inspectionCalculationMethods).values({
      inspectionObjectCode: OBJ,
      inspectionParameterCode: PARAM,
      testingStandardCode: STD_A,
      formula: "old",
    });
    try {
      const res = await app.inject({
        method: "PUT",
        url: PATH2,
        headers: authz,
        payload: { formula: "x * 2.0", testingStandardCode: "R2-HACK" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().formula).toBe("x * 2.0");
      expect(res.json().testingStandardCode).toBe(STD_A);
    } finally {
      await cleanupAll();
    }
  });
});

describe("DELETE /api/calculation-methods/{obj}/{param}", () => {
  fnTest(
    ["M06.F05.I05"],
    "DELETE→204；missing→404（终审 I-1 修正）；删该 obj+param 全部 standard 行",
    async () => {
      await db.insert(inspectionCalculationMethods).values([
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          testingStandardCode: STD_A,
        },
        {
          inspectionObjectCode: OBJ,
          inspectionParameterCode: PARAM,
          testingStandardCode: STD_B,
        },
      ]);
      const res = await app.inject({ method: "DELETE", url: PATH2, headers: authz });
      expect(res.statusCode).toBe(204);
      const again = await app.inject({ method: "DELETE", url: PATH2, headers: authz });
      expect(again.statusCode).toBe(404);
      expect(again.json()).toEqual({
        code: "NOT_FOUND",
        message: "CalculationMethod not found",
      });
      const rows = await db
        .select()
        .from(inspectionCalculationMethods)
        .where(
          and(
            eq(inspectionCalculationMethods.inspectionObjectCode, OBJ),
            eq(inspectionCalculationMethods.inspectionParameterCode, PARAM),
          ),
        );
      expect(rows).toHaveLength(0);
    },
  );
});

describe("401 全域", () => {
  // 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
  it("无 token → UNAUTHORIZED 信封逐字面", async () => {
    const res = await app.inject({ method: "GET", url: "/api/calculation-methods" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "tenant_id claim is required (ADR-0019)",
    });
  });
});
