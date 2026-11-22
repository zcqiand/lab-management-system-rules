// M06.F05 计算方法域：list 裸数组（不分页）+ create + 2 键路径三端点。
// 逐语义镜像 nextjs src/app/api/calculation-methods/** + db-queries-calc-techreq：
// 2 键路径 = testingStandardCode 升序首个（R6-1 已人裁——PK 实为 3 键而路径 2 段，
// mock find 首个语义确定性化）；PUT PATCH 作用于首个行且 PK 三键不可 patch；
// DELETE 删该 obj+param 全部 standard 行（nextjs 同款）且 missing→404（nextjs
// 逐字面，终审 I-1 修正——plan 初稿「幂等 204」系语义误记，已废）；
// create 缺 testingStandardCode → 400
// 指名（R6-2 fail-fast：库列 NN+PK+FK）、dup 3 键 → 400「已存在」；wire 缺省
// algorithmType="manual"（照 nextjs 路由实际行为）；行附加派生 id cr-<obj>-<param>。
import type { FastifyInstance } from "fastify";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import { inspectionCalculationMethods } from "../db/schema.js";

type Row = Record<string, unknown>;

type FastifyLike = {
  code(status: number): { send(body?: unknown): unknown };
};

const PK_KEYS = [
  "inspectionObjectCode",
  "inspectionParameterCode",
  "testingStandardCode",
] as const;

const COLS = getTableColumns(inspectionCalculationMethods);

/** 编目行 DTO：null/undefined 键剔除（契约无 null 值；时间列 mode string 已是 ISO）。 */
function toDto(row: Row): Row {
  const dto = { ...row };
  for (const k of Object.keys(dto)) {
    if (dto[k] === null || dto[k] === undefined) delete dto[k];
  }
  return dto;
}

function withDerivedId(dto: Row): Row {
  return {
    ...dto,
    id: "cr-" + dto.inspectionObjectCode + "-" + dto.inspectionParameterCode,
  };
}

function notFound(reply: FastifyLike, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message });
}

export async function calculationMethodRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/api/calculation-methods";
  const now = () => new Date().toISOString();

  app.get(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const conds: SQL[] = [];
    if (q.inspectionObjectCode)
      conds.push(
        eq(inspectionCalculationMethods.inspectionObjectCode, q.inspectionObjectCode),
      );
    if (q.inspectionParameterCode)
      conds.push(
        eq(
          inspectionCalculationMethods.inspectionParameterCode,
          q.inspectionParameterCode,
        ),
      );
    if (q.testingStandardCode)
      conds.push(
        eq(inspectionCalculationMethods.testingStandardCode, q.testingStandardCode),
      );
    const items = (
      await db
        .select()
        .from(inspectionCalculationMethods)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(inspectionCalculationMethods.testingStandardCode))
    ).map((r) => withDerivedId(toDto(r as Row)));
    // 契约：裸数组不分页（SSOT listCalculationMethods 返数组——T11 live 四方比对实证）
    return reply.send(items);
  });

  app.post(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as Row;
    // R6-2：库列 NN+PK+FK 三重约束，缺 standard 无法落库——400 指名（fail-fast）
    if (!body.testingStandardCode) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "testingStandardCode 必填（库列非空且为主键成员）",
      });
    }
    const dupConds = [
      eq(
        inspectionCalculationMethods.inspectionObjectCode,
        String(body.inspectionObjectCode ?? ""),
      ),
      eq(
        inspectionCalculationMethods.inspectionParameterCode,
        String(body.inspectionParameterCode ?? ""),
      ),
      eq(
        inspectionCalculationMethods.testingStandardCode,
        String(body.testingStandardCode),
      ),
    ];
    const dup = await db
      .select({ o: inspectionCalculationMethods.inspectionObjectCode })
      .from(inspectionCalculationMethods)
      .where(and(...dupConds))
      .limit(1);
    if (dup.length) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "计算方法已存在（object+parameter+standard）",
      });
    }
    const merged: Row = {
      algorithmType: "manual",
      sortOrder: 0,
      createdAt: now(),
      updatedAt: now(),
      ...body,
    };
    const vals: Row = {};
    for (const k of Object.keys(COLS)) {
      if (k in merged) vals[k] = merged[k];
    }
    vals.sortOrder = Number(vals.sortOrder ?? 0);
    const inserted = await db
      .insert(inspectionCalculationMethods)
      .values(vals as never)
      .returning();
    return reply.code(201).send(withDerivedId(toDto(inserted[0] as Row)));
  });

  const PATH2 = "/:inspectionObjectCode/:inspectionParameterCode";

  app.get(`${BASE}${PATH2}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
    };
    // R6-1：2 键路径取 standard 升序首个
    const rows = await db
      .select()
      .from(inspectionCalculationMethods)
      .where(
        and(
          eq(inspectionCalculationMethods.inspectionObjectCode, p.inspectionObjectCode),
          eq(
            inspectionCalculationMethods.inspectionParameterCode,
            p.inspectionParameterCode,
          ),
        ),
      )
      .orderBy(asc(inspectionCalculationMethods.testingStandardCode))
      .limit(1);
    if (!rows[0]) return notFound(reply, "CalculationMethod not found");
    return reply.send(withDerivedId(toDto(rows[0] as Row)));
  });

  app.put(`${BASE}${PATH2}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
    };
    // PATCH 作用于首个行（R6-1）；PK 三键不可被 patch 改写；盖戳
    const first = await db
      .select()
      .from(inspectionCalculationMethods)
      .where(
        and(
          eq(inspectionCalculationMethods.inspectionObjectCode, p.inspectionObjectCode),
          eq(
            inspectionCalculationMethods.inspectionParameterCode,
            p.inspectionParameterCode,
          ),
        ),
      )
      .orderBy(asc(inspectionCalculationMethods.testingStandardCode))
      .limit(1);
    if (!first[0]) return notFound(reply, "CalculationMethod not found");
    const patch = (req.body ?? {}) as Row;
    const vals: Row = { updatedAt: now() };
    for (const [k, v] of Object.entries(patch)) {
      if ((PK_KEYS as readonly string[]).includes(k)) continue;
      if (k in COLS) vals[k] = v;
    }
    const updated = await db
      .update(inspectionCalculationMethods)
      .set(vals as never)
      .where(
        and(
          eq(
            inspectionCalculationMethods.inspectionObjectCode,
            String(first[0].inspectionObjectCode),
          ),
          eq(
            inspectionCalculationMethods.inspectionParameterCode,
            String(first[0].inspectionParameterCode),
          ),
          eq(
            inspectionCalculationMethods.testingStandardCode,
            String(first[0].testingStandardCode),
          ),
        ),
      )
      .returning();
    if (!updated[0]) return notFound(reply, "CalculationMethod not found");
    return reply.send(withDerivedId(toDto(updated[0] as Row)));
  });

  app.delete(`${BASE}${PATH2}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
    };
    // 删该 obj+param 全部 standard 行（nextjs 同款）；missing→404（nextjs 逐字面）
    const deleted = await db
      .delete(inspectionCalculationMethods)
      .where(
        and(
          eq(inspectionCalculationMethods.inspectionObjectCode, p.inspectionObjectCode),
          eq(
            inspectionCalculationMethods.inspectionParameterCode,
            p.inspectionParameterCode,
          ),
        ),
      )
      .returning();
    if (!deleted[0]) {
      return notFound(reply, "CalculationMethod not found");
    }
    return reply.code(204).send();
  });
}
