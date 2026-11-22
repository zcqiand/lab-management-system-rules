import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  inspectionCalculationMethods,
  inspectionTechnicalRequirements,
  testRecords,
} from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// R2 Task 11（REQ-2026-043 calc 段）：evaluate + records 复现链。
// TODO(锚回填): fnTest 锚 M06.F10.I01（evaluate）/ M06.F10.I02（records 复现）
// 待 shared I 行 --approve + rules mirror --apply 后补挂（Task 11 Ruling：无锚先行）。
// 数据面：lab_test 真库；FK 用种子现行行 IP-0005/IP-0009/IP-0010 + GB 13788-2024
// + SAMPLE-FM-0017；OBJ-PG-T-CALC < OBJ-SP01-P1（obj 升序首个判别）。
// calc 方法行只建 IP-0005/IP-0009 组（零现存行，不碰种子）；IP-0010 只有
// 他 obj 他 std 的种子行（r2-calc-rec-2 走「无 method 行」路径）。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };
const tokenB = await app.labJwt.issue("test-user", "tenant-B");
const authzB = { authorization: `Bearer ${tokenB}` };

const OBJ_A = "OBJ-PG-T-CALC"; // 升序在前 → records 链取它
const OBJ_B = "OBJ-SP01-P1";
const PARAM = "IP-0005";
const STD = "GB 13788-2024";
const SAMPLE = "SAMPLE-FM-0017";
const REC_1 = "r2-calc-rec-1";
const REC_2 = "r2-calc-rec-2";
const REC_3 = "r2-calc-rec-3";
const REC_IDS = [REC_1, REC_2, REC_3];
const BASE = "/api/calc";

async function cleanupAll() {
  await db.delete(testRecords).where(inArray(testRecords.id, REC_IDS));
  await db
    .delete(inspectionCalculationMethods)
    .where(
      and(
        inArray(inspectionCalculationMethods.inspectionObjectCode, [OBJ_A, OBJ_B]),
        inArray(inspectionCalculationMethods.inspectionParameterCode, [PARAM, "IP-0009"]),
      ),
    );
  await db
    .delete(inspectionTechnicalRequirements)
    .where(
      and(
        eq(inspectionTechnicalRequirements.inspectionObjectCode, OBJ_A),
        eq(inspectionTechnicalRequirements.inspectionParameterCode, PARAM),
        eq(inspectionTechnicalRequirements.judgmentStandardCode, STD),
      ),
    );
}

beforeAll(async () => {
  await cleanupAll();
  await db.insert(inspectionCalculationMethods).values([
    {
      inspectionObjectCode: OBJ_A,
      inspectionParameterCode: PARAM,
      testingStandardCode: STD,
      algorithmType: "formula",
      formula: "avg(R1, R2, R3)",
    },
    {
      inspectionObjectCode: OBJ_B,
      inspectionParameterCode: PARAM,
      testingStandardCode: STD,
      algorithmType: "manual",
      formula: "ROUND_HALF_EVEN(R1, 1)",
    },
    {
      inspectionObjectCode: OBJ_A,
      inspectionParameterCode: "IP-0009",
      testingStandardCode: STD,
      algorithmType: "manual",
      formula: null,
    },
  ]);
  await db.insert(inspectionTechnicalRequirements).values({
    inspectionObjectCode: OBJ_A,
    inspectionParameterCode: PARAM,
    judgmentStandardCode: STD,
    comparison: "≥",
    minValue: "30",
    unit: "MPa",
    valueType: "numeric",
    judgmentMode: "automatic",
    verificationStatus: "verified",
  });
  await db.insert(testRecords).values([
    {
      id: REC_1,
      sampleId: SAMPLE,
      parameterCode: PARAM,
      standardCode: STD,
      ext: { R1: 33, R2: 34, R3: 35, note: "x" },
      requirement: "≥30",
      result: "34",
      tenantId: "tenant-A",
    },
    {
      id: REC_2,
      sampleId: SAMPLE,
      parameterCode: "IP-0010",
      standardCode: STD,
      ext: {},
      requirement: "-",
      result: "-",
      tenantId: "tenant-A",
    },
    {
      id: REC_3,
      sampleId: SAMPLE,
      parameterCode: "IP-0009",
      standardCode: STD,
      ext: { R1: 10 },
      requirement: "-",
      result: "-",
      tenantId: "tenant-A",
    },
  ]);
});

afterAll(async () => {
  await cleanupAll();
  await app.close();
});

describe("POST /api/calc/evaluate", () => {
  // TODO(锚回填 M06.F10.I01)
  it("纯公式三组 contexts → strengths/mean 逐位（mean 只取有效组全精度）", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${BASE}/evaluate`,
      headers: authz,
      payload: {
        formula: "avg(R1, R2, R3)",
        contexts: [
          { R1: 33, R2: 34, R3: 35 },
          { R1: 30, R2: 31, R3: 32 },
          { R1: 35, R2: 36, R3: 37 },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.strengths).toEqual([34, 31, 36]);
    expect(body.mean).toBeCloseTo(101 / 3, 6);
    expect(body.errors).toEqual([]);
    expect(body.verdict).toBe(""); // 无 techReq → 不产 verdict
  });

  it("公式语法错 → 200 且 errors 含 FORMULA_PARSE_ERROR（错误进 errors 非 5xx）", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${BASE}/evaluate`,
      headers: authz,
      payload: { formula: "1+", contexts: [{ R1: 1 }, { R1: 2 }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.strengths).toEqual([null, null]);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].code).toBe("FORMULA_PARSE_ERROR");
    expect(body.mean).toBeNull();
  });

  it("带 techReq → verdict 服务侧判定（≥+minValue 双向）", async () => {
    const ok = await app.inject({
      method: "POST",
      url: `${BASE}/evaluate`,
      headers: authz,
      payload: {
        formula: "avg(R1, R2, R3)",
        contexts: [{ R1: 33, R2: 34, R3: 35 }],
        techReq: { comparison: "≥", minValue: 30 },
      },
    });
    expect(ok.json().verdict).toBe("合格");
    const bad = await app.inject({
      method: "POST",
      url: `${BASE}/evaluate`,
      headers: authz,
      payload: {
        formula: "avg(R1, R2, R3)",
        contexts: [{ R1: 33, R2: 34, R3: 35 }],
        techReq: { comparison: "≥", minValue: 40 },
      },
    });
    expect(bad.json().verdict).toBe("不合格");
  });
});

describe("GET /api/calc/records/:recordId", () => {
  // TODO(锚回填 M06.F10.I02)
  it("无 token → 401（ADR-0019 禁兜底）", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/records/${REC_1}`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  it("他租户 id → 404（tenant 收口，非 403）", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/records/${REC_1}`,
      headers: authzB,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND"); // 业务 404 非 Fastify 路由缺失 404
  });

  it("全链 → 200：method 行 obj 升序首个 + ext 数值键单组复算 + techReq verdict", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/records/${REC_1}`,
      headers: authz,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // OBJ_A 行 formula=avg(R1,R2,R3)：ext 数值键 {33,34,35}（note 字符串被剔除）→ mean 34
    expect(body.strengths).toEqual([34]);
    expect(body.mean).toBe(34);
    expect(body.errors).toEqual([]);
    // techReq（OBJ_A+IP-0005+STD verified ≥30）→ 服务侧判定
    expect(body.verdict).toBe("合格");
  });

  it("无 method 行 → 404 CALC_METHOD_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/records/${REC_2}`,
      headers: authz,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("CALC_METHOD_NOT_FOUND");
  });

  it("method 行 formula 空 → 404 CALC_METHOD_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${BASE}/records/${REC_3}`,
      headers: authz,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("CALC_METHOD_NOT_FOUND");
  });
});
