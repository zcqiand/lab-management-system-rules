// M06.F10 calc 段：POST /api/calc/evaluate + GET /api/calc/records/:recordId。
// evaluate = 引擎内核直通 + 服务侧 verdict（autoVerdict，Task 11 语义镜像
// nextjs cement-strength.ts）；records = 只读复现链（plan R2 裁定：不落库）：
//   test_record（tenant 收口，无/他租户 → 404 NOT_FOUND）
//   → calc_methods 行（param+std，多行取 inspectionObjectCode 升序首个——裁定钉死）
//   → 无行 / formula 空 → 404 CALC_METHOD_NOT_FOUND
//   → contexts = [ext 数值键值集]（typeof number 且 finite，严格不转字符串——Ruling）
//   → techReq 同 obj/param/judgmentStandard 首行（verified 优先，sortOrder 升序）
//   → autoVerdict。
import type { FastifyInstance } from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import { autoVerdict, type TechReqLike } from "../lib/verdict.js";
import { evaluateFormula } from "../lib/calc-engine/evaluate.js";
import {
  inspectionCalculationMethods,
  inspectionTechnicalRequirements,
  testRecords,
} from "../db/schema.js";

interface EvaluateBody {
  formula?: unknown;
  contexts?: unknown;
  techReq?: unknown;
}

interface CalcResultWire {
  strengths: (number | null)[];
  mean: number | null;
  errors: unknown[];
}

/** ext（jsonb）→ 单组 context：只收 typeof number 且 finite 的键值。 */
function extToContext(ext: unknown): Record<string, number> {
  const ctx: Record<string, number> = {};
  if (ext && typeof ext === "object") {
    for (const [k, v] of Object.entries(ext as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) ctx[k] = v;
    }
  }
  return ctx;
}

export async function calcRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/calc/evaluate", async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as EvaluateBody;
    if (!body.formula || !Array.isArray(body.contexts)) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "formula 与 contexts 必填",
      });
    }
    const result = evaluateFormula({
      formula: String(body.formula),
      contexts: body.contexts as Record<string, number>[],
    });
    const techReq = body.techReq as TechReqLike | undefined;
    const verdict = techReq ? autoVerdict(result.mean ?? undefined, techReq) : "";
    return reply.send({ ...result, verdict });
  });

  app.get("/api/calc/records/:recordId", async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { recordId } = req.params as { recordId: string };
    const recs = await db
      .select()
      .from(testRecords)
      .where(and(eq(testRecords.id, recordId), eq(testRecords.tenantId, auth.tenantId)))
      .limit(1);
    const rec = recs[0];
    if (!rec) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "TestRecord not found" });
    }
    if (!rec.standardCode) {
      return reply.code(404).send({
        code: "CALC_METHOD_NOT_FOUND",
        message: "记录无判定标准，无计算方法可复现",
      });
    }
    const methods = await db
      .select()
      .from(inspectionCalculationMethods)
      .where(
        and(
          eq(inspectionCalculationMethods.inspectionParameterCode, rec.parameterCode),
          eq(inspectionCalculationMethods.testingStandardCode, rec.standardCode),
        ),
      )
      .orderBy(asc(inspectionCalculationMethods.inspectionObjectCode))
      .limit(1);
    const method = methods[0];
    if (!method?.formula) {
      return reply.code(404).send({
        code: "CALC_METHOD_NOT_FOUND",
        message: "CalculationMethod not found",
      });
    }
    const result = evaluateFormula({
      formula: method.formula,
      contexts: [extToContext(rec.ext)],
    });
    const trs = await db
      .select()
      .from(inspectionTechnicalRequirements)
      .where(
        and(
          eq(
            inspectionTechnicalRequirements.inspectionObjectCode,
            method.inspectionObjectCode,
          ),
          eq(inspectionTechnicalRequirements.inspectionParameterCode, rec.parameterCode),
          eq(inspectionTechnicalRequirements.judgmentStandardCode, rec.standardCode),
        ),
      )
      .orderBy(
        sql`case when ${inspectionTechnicalRequirements.verificationStatus} = 'verified' then 0 else 1 end`,
        asc(inspectionTechnicalRequirements.sortOrder),
      )
      .limit(1);
    const tr = trs[0];
    const techReq: TechReqLike | undefined = tr
      ? {
          comparison: tr.comparison,
          minValue: tr.minValue != null ? Number(tr.minValue) : null,
          maxValue: tr.maxValue != null ? Number(tr.maxValue) : null,
          valueType: tr.valueType,
        }
      : undefined;
    const verdict = autoVerdict(result.mean ?? undefined, techReq);
    const wire: CalcResultWire & { verdict: string } = { ...result, verdict };
    return reply.send(wire);
  });
}
