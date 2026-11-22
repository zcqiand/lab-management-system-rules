// M06.F06 技术要求域：list 裸数组（不分页）+ create + 3 键路径三端点。
// 逐语义镜像 nextjs src/app/api/technical-requirements/** + db-queries-calc-techreq：
// 3 键路径 = '' 哨兵精确命中（Task 9 Ruling：变体列全 '' 才算命中，变体行不入
// 三键寻址——非 plan 初稿的 sortOrder 首个，nextjs getTechReqDb 注释明言 calc
// 域 R6-1 不适用）；PUT PATCH 语义且 PK 8 键成员不可 patch；DELETE 幂等 204
// 且只删哨兵行（变体族保留，plan R2 裁定，非 nextjs missing→404——CT 容 200/204）；
// create 缺 comparison → 400 指名（R6-2 fail-fast）、dup 8 键 → 400「已存在」
// （V020 变体维度）、变体列缺省归一 '' 哨兵；list 行附加派生 id
// tr-<obj>-<param>-<std>（表无 id 列，契约注记形状）。
import type { FastifyInstance } from "fastify";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import { inspectionTechnicalRequirements } from "../db/schema.js";

type Row = Record<string, unknown>;

type FastifyLike = {
  code(status: number): { send(body?: unknown): unknown };
};

const VARIANT_KEYS = ["brand", "model", "spec", "grade", "sieve"] as const;
const PK_KEYS = [
  "inspectionObjectCode",
  "inspectionParameterCode",
  "judgmentStandardCode",
  ...VARIANT_KEYS,
] as const;

const COLS = getTableColumns(inspectionTechnicalRequirements);

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
    id:
      "tr-" +
      dto.inspectionObjectCode +
      "-" +
      dto.inspectionParameterCode +
      "-" +
      dto.judgmentStandardCode,
  };
}

function notFound(reply: FastifyLike, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message });
}

/** 3 键路径 where：三键 + 5 变体列全 ''（'' 哨兵精确命中）。 */
function sentinelWhere(obj: string, param: string, std: string) {
  return and(
    eq(inspectionTechnicalRequirements.inspectionObjectCode, obj),
    eq(inspectionTechnicalRequirements.inspectionParameterCode, param),
    eq(inspectionTechnicalRequirements.judgmentStandardCode, std),
    eq(inspectionTechnicalRequirements.brand, ""),
    eq(inspectionTechnicalRequirements.model, ""),
    eq(inspectionTechnicalRequirements.spec, ""),
    eq(inspectionTechnicalRequirements.grade, ""),
    eq(inspectionTechnicalRequirements.sieve, ""),
  );
}

export async function technicalRequirementRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/api/technical-requirements";
  const now = () => new Date().toISOString();

  app.get(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const conds: SQL[] = [];
    if (q.inspectionObjectCode)
      conds.push(
        eq(inspectionTechnicalRequirements.inspectionObjectCode, q.inspectionObjectCode),
      );
    if (q.inspectionParameterCode)
      conds.push(
        eq(
          inspectionTechnicalRequirements.inspectionParameterCode,
          q.inspectionParameterCode,
        ),
      );
    if (q.judgmentStandardCode)
      conds.push(
        eq(inspectionTechnicalRequirements.judgmentStandardCode, q.judgmentStandardCode),
      );
    const items = (
      await db
        .select()
        .from(inspectionTechnicalRequirements)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(
          asc(inspectionTechnicalRequirements.judgmentStandardCode),
          asc(inspectionTechnicalRequirements.sortOrder),
          asc(inspectionTechnicalRequirements.brand),
          asc(inspectionTechnicalRequirements.model),
          asc(inspectionTechnicalRequirements.spec),
          asc(inspectionTechnicalRequirements.grade),
          asc(inspectionTechnicalRequirements.sieve),
        )
    ).map((r) => withDerivedId(toDto(r as Row)));
    // 契约：裸数组不分页（SSOT listTechnicalRequirements 返数组）
    return reply.send(items);
  });

  app.post(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as Row;
    // R6-2：comparison NN 无默认，缺列无法落库——400 指名（fail-fast 禁兜底）
    if (!body.comparison) {
      return reply
        .code(400)
        .send({ code: "VALIDATION_ERROR", message: "comparison 必填（库列非空）" });
    }
    const obj = String(body.inspectionObjectCode ?? "");
    const param = String(body.inspectionParameterCode ?? "");
    const std = String(body.judgmentStandardCode ?? "");
    // dup 8 键预查（V020 PK 扩维；变体列 undefined 归一 ''）
    const dupConds = [
      eq(inspectionTechnicalRequirements.inspectionObjectCode, obj),
      eq(inspectionTechnicalRequirements.inspectionParameterCode, param),
      eq(inspectionTechnicalRequirements.judgmentStandardCode, std),
    ];
    for (const k of VARIANT_KEYS) {
      dupConds.push(eq(COLS[k], String(body[k] ?? "")));
    }
    const dup = await db
      .select({ o: inspectionTechnicalRequirements.inspectionObjectCode })
      .from(inspectionTechnicalRequirements)
      .where(and(...dupConds))
      .limit(1);
    if (dup.length) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message:
          "技术要求已存在（object+parameter+standard+brand/model/spec/grade/sieve 变体维度）",
      });
    }
    const merged: Row = {
      valueType: "numeric",
      judgmentMode: "manual",
      verificationStatus: "draft",
      sortOrder: 0,
      createdAt: now(),
      updatedAt: now(),
      ...body,
    };
    const vals: Row = {};
    for (const k of Object.keys(COLS)) {
      if (k in merged) vals[k] = merged[k];
    }
    // 终审 Important #1（2026-11-15）同款归一：变体列显式 null → ''（'' 哨兵=不限维度）
    for (const k of VARIANT_KEYS) {
      if (vals[k] === null || vals[k] === undefined) vals[k] = "";
    }
    vals.sortOrder = Number(vals.sortOrder ?? 0);
    const inserted = await db
      .insert(inspectionTechnicalRequirements)
      .values(vals as never)
      .returning();
    return reply.code(201).send(withDerivedId(toDto(inserted[0] as Row)));
  });

  const PATH3 = "/:inspectionObjectCode/:inspectionParameterCode/:judgmentStandardCode";

  app.get(`${BASE}${PATH3}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
      judgmentStandardCode: string;
    };
    const rows = await db
      .select()
      .from(inspectionTechnicalRequirements)
      .where(
        sentinelWhere(
          p.inspectionObjectCode,
          p.inspectionParameterCode,
          p.judgmentStandardCode,
        ),
      )
      .limit(1);
    if (!rows[0]) return notFound(reply, "TechnicalRequirement not found");
    return reply.send(withDerivedId(toDto(rows[0] as Row)));
  });

  app.put(`${BASE}${PATH3}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
      judgmentStandardCode: string;
    };
    const patch = (req.body ?? {}) as Row;
    // PATCH 语义：PK 8 键成员不可被 patch 改写；键集过滤到表列；盖戳
    const vals: Row = { updatedAt: now() };
    for (const [k, v] of Object.entries(patch)) {
      if ((PK_KEYS as readonly string[]).includes(k)) continue;
      if (k in COLS) vals[k] = v;
    }
    const updated = await db
      .update(inspectionTechnicalRequirements)
      .set(vals as never)
      .where(
        sentinelWhere(
          p.inspectionObjectCode,
          p.inspectionParameterCode,
          p.judgmentStandardCode,
        ),
      )
      .returning();
    if (!updated[0]) return notFound(reply, "TechnicalRequirement not found");
    return reply.send(withDerivedId(toDto(updated[0] as Row)));
  });

  app.delete(`${BASE}${PATH3}`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const p = req.params as {
      inspectionObjectCode: string;
      inspectionParameterCode: string;
      judgmentStandardCode: string;
    };
    // 幂等 204，且只删哨兵行（变体族保留——旧「删全族」作废）
    await db
      .delete(inspectionTechnicalRequirements)
      .where(
        sentinelWhere(
          p.inspectionObjectCode,
          p.inspectionParameterCode,
          p.judgmentStandardCode,
        ),
      );
    return reply.code(204).send();
  });
}
