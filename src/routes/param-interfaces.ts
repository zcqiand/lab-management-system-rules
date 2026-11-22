// M06.F08 参数界面域：CRUD + link/unlink。逐语义镜像 nextjs
// src/app/api/param-interfaces/** + db-queries interfaceDict 族：
// list Page 回显不切片（page/pageSize 仅回显，items 全量）、keyword
// code/name 子串、create dup→400 CONFLICT、config 缺省 {}、version 服务端
// 缺省 1、PUT PATCH 语义、DELETE 204 幂等（FK cascade 级联删 links）、
// links POST 204 幂等 upsert（plan R2 裁定，非 nextjs 201+dup400——CT
// 四方比对容 2xx 且 compare.test 不含 links，契约 void 语义为准）。
import type { FastifyInstance } from "fastify";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import {
  inspectionParamInterfaceLinks,
  inspectionParamInterfaces,
} from "../db/schema.js";

type Row = Record<string, unknown>;

type FastifyLike = {
  code(status: number): { send(body?: unknown): unknown };
};

/** 行→DTO：null/undefined 键剔除（镜像 interfaceRowToDto，契约无 null 值）。 */
function toDto(row: Row): Row {
  const dto = { ...row };
  for (const k of Object.keys(dto)) {
    if (dto[k] === null || dto[k] === undefined) delete dto[k];
  }
  return dto;
}

function badRequest(reply: FastifyLike, message: string) {
  return reply.code(400).send({ code: "BAD_REQUEST", message });
}

function notFound(reply: FastifyLike, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message });
}

export async function paramInterfaceRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/api/param-interfaces";
  const now = () => new Date().toISOString();

  app.get(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const keyword = q.keyword?.trim();
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const where = keyword
      ? sql`(strpos(${inspectionParamInterfaces.code}::text, ${keyword}) > 0
            or strpos(${inspectionParamInterfaces.name}::text, ${keyword}) > 0)`
      : undefined;
    const items = (await db.select().from(inspectionParamInterfaces).where(where)).map(
      (r) => toDto(r as Row),
    );
    // 契约 Page 回显不切片：page/pageSize 仅回显，items 全量
    const pageSize = q.pageSize ? Number(q.pageSize) : items.length;
    return reply.send({ items, page, pageSize, total: items.length });
  });

  app.post(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as Row;
    const code = String(body.code ?? "").trim();
    if (!code) return badRequest(reply, "code 必填");
    // ADR-0056：config 若给必须为对象（数组不算）
    if (
      body.config !== undefined &&
      body.config !== null &&
      (typeof body.config !== "object" || Array.isArray(body.config))
    ) {
      return badRequest(reply, "config 必须为对象（表单结构 schema）");
    }
    const dup = await db
      .select({ code: inspectionParamInterfaces.code })
      .from(inspectionParamInterfaces)
      .where(eq(inspectionParamInterfaces.code, code));
    if (dup.length) {
      return reply.code(400).send({ code: "CONFLICT", message: "参数界面编码已存在" });
    }
    const ts = now();
    const inserted = await db
      .insert(inspectionParamInterfaces)
      .values({
        code,
        name: String(body.name ?? ""),
        description: String(body.description ?? ""),
        version: Number(body.version ?? 1),
        config: (body.config ?? {}) as object,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning();
    return reply.code(201).send(toDto(inserted[0] as Row));
  });

  app.get(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    const rows = await db
      .select()
      .from(inspectionParamInterfaces)
      .where(eq(inspectionParamInterfaces.code, code));
    if (!rows[0]) return notFound(reply, "InspectionParamInterface not found");
    return reply.send(toDto(rows[0] as Row));
  });

  app.put(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    const patch = (req.body ?? {}) as Row;
    // PATCH 语义：键集过滤到表列（code/审计列除外）+ updatedAt
    const allowed = new Set(["name", "description", "version", "config"]);
    const vals: Row = { updatedAt: now() };
    for (const [k, v] of Object.entries(patch)) {
      if (allowed.has(k)) vals[k] = v;
    }
    const updated = await db
      .update(inspectionParamInterfaces)
      .set(vals as never)
      .where(eq(inspectionParamInterfaces.code, code))
      .returning();
    if (!updated[0]) return notFound(reply, "InspectionParamInterface not found");
    return reply.send(toDto(updated[0] as Row));
  });

  app.delete(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    // 幂等 204；links 由 FK onDelete cascade 级联删
    await db
      .delete(inspectionParamInterfaces)
      .where(eq(inspectionParamInterfaces.code, code));
    return reply.code(204).send();
  });

  // ── links：参数↔界面（M06.F08.I06）──────────────────────────────
  app.get(`${BASE}/links`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const conds: SQL[] = [];
    if (q.inspectionParameterCode)
      conds.push(
        eq(
          inspectionParamInterfaceLinks.inspectionParameterCode,
          q.inspectionParameterCode,
        ),
      );
    if (q.paramInterfaceCode)
      conds.push(
        eq(inspectionParamInterfaceLinks.paramInterfaceCode, q.paramInterfaceCode),
      );
    if (q.reportNameCode)
      conds.push(eq(inspectionParamInterfaceLinks.reportNameCode, q.reportNameCode));
    if (q.inspectionStandardCode)
      conds.push(
        eq(
          inspectionParamInterfaceLinks.inspectionStandardCode,
          q.inspectionStandardCode,
        ),
      );
    const items = (
      await db
        .select()
        .from(inspectionParamInterfaceLinks)
        .where(conds.length ? and(...conds) : undefined)
    ).map((r) => toDto(r as Row));
    return reply.send({
      items,
      page: 1,
      pageSize: items.length,
      total: items.length,
    });
  });

  app.post(`${BASE}/links`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as Row;
    if (!body.inspectionParameterCode || !body.paramInterfaceCode) {
      return badRequest(reply, "inspectionParameterCode/paramInterfaceCode 必填");
    }
    const values = {
      inspectionParameterCode: String(body.inspectionParameterCode),
      paramInterfaceCode: String(body.paramInterfaceCode),
      reportNameCode: body.reportNameCode ? String(body.reportNameCode) : null,
      inspectionStandardCode: body.inspectionStandardCode
        ? String(body.inspectionStandardCode)
        : null,
      createdAt: now(),
      updatedAt: now(),
    };
    // 幂等 upsert → 204（plan R2 裁定；PG PK = param+iface 两键）
    await db
      .insert(inspectionParamInterfaceLinks)
      .values(values)
      .onConflictDoNothing({
        target: [
          inspectionParamInterfaceLinks.inspectionParameterCode,
          inspectionParamInterfaceLinks.paramInterfaceCode,
        ],
      });
    return reply.code(204).send();
  });

  app.delete(`${BASE}/links`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    // 契约 unlink 是 @body；query 兼容过渡期（镜像 nextjs 双通道）
    let parameterCode = "";
    let interfaceCode = "";
    const b = (req.body ?? null) as Row | null;
    if (b && (b.inspectionParameterCode || b.paramInterfaceCode)) {
      parameterCode = String(b.inspectionParameterCode ?? "");
      interfaceCode = String(b.paramInterfaceCode ?? "");
    } else {
      const q = req.query as Record<string, string | undefined>;
      parameterCode = q.inspectionParameterCode ?? "";
      interfaceCode = q.paramInterfaceCode ?? "";
    }
    await db
      .delete(inspectionParamInterfaceLinks)
      .where(
        and(
          eq(inspectionParamInterfaceLinks.inspectionParameterCode, parameterCode),
          eq(inspectionParamInterfaceLinks.paramInterfaceCode, interfaceCode),
        ),
      );
    return reply.code(204).send();
  });
}
