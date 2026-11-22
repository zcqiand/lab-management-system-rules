// M04.F06-F09 四码表（brands/models/specs/grades 四族同构）。
// 逐语义镜像 nextjs catalog-handlers.ts + db-queries.ts（listDictDb/createDictDb/
// putDictDb/deleteDictDb）：LIMIT/OFFSET 真切片（pageSize 缺省=total，空集=0）、
// id=code 补列、inspectionObjectCode 直列过滤、keyword 静默忽略（契约层不传）、
// 重复 code→400「编码已存在」、missing→404「Entry not found」。
// 四表无 tenant 列（平台级码表）；requireTenant 只做身份门槛（ADR-0019）。
import type { FastifyInstance } from "fastify";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import {
  inspectionBrands,
  inspectionGrades,
  inspectionModels,
  inspectionSpecs,
} from "../db/schema.js";

type DictRow = Record<string, unknown>;

interface DictCfg {
  table: PgTable;
  code: PgColumn;
  sortCol: PgColumn;
  objCol: PgColumn;
}

function cfgOf(
  table: PgTable & {
    code: PgColumn;
    name: PgColumn;
    sortOrder: PgColumn;
    inspectionObjectCode: PgColumn;
  },
): DictCfg {
  return {
    table,
    code: table.code,
    sortCol: table.sortOrder,
    objCol: table.inspectionObjectCode,
  };
}

const CFGS = {
  brands: cfgOf(inspectionBrands),
  models: cfgOf(inspectionModels),
  specs: cfgOf(inspectionSpecs),
  grades: cfgOf(inspectionGrades),
} as const;

type Family = keyof typeof CFGS;

/** 行→DTO：剥 null/undefined 键（镜像 dictRowToDto）。 */
function toDto(row: DictRow, patchId: boolean): DictRow {
  const dto: DictRow = { ...row };
  for (const k of Object.keys(dto)) {
    if (dto[k] === null || dto[k] === undefined) delete dto[k];
  }
  if (patchId) dto.id = String(dto.code);
  return dto;
}

function badRequest(reply: FastifyLike, message: string) {
  return reply.code(400).send({ code: "BAD_REQUEST", message });
}

function notFound(reply: FastifyLike, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message });
}

type FastifyLike = {
  code(status: number): { send(body?: unknown): unknown };
};

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  const register = (family: Family) => {
    const cfg = CFGS[family];
    const base = `/api/catalog/${family}`;
    const cols = getTableColumns(cfg.table);

    app.get(base, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const q = req.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const pageSizeParam = q.pageSize;
      const pageSize =
        pageSizeParam &&
        Number.isInteger(Number(pageSizeParam)) &&
        Number(pageSizeParam) > 0
          ? Number(pageSizeParam)
          : null;

      const where = q.inspectionObjectCode
        ? eq(cfg.objCol, q.inspectionObjectCode)
        : undefined;

      const counted = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(cfg.table)
        .where(where);
      const total = counted[0]?.n ?? 0;
      const pageSizeEff = pageSize ?? total; // 空集=0（CT live 收口，禁 || 1 兜底）

      const rows = await db
        .select()
        .from(cfg.table)
        .where(where)
        .orderBy(asc(cfg.sortCol), asc(cfg.code))
        .limit(pageSizeEff)
        .offset((page - 1) * pageSizeEff);
      return reply.send({
        items: rows.map((r) => toDto(r as DictRow, true)),
        page,
        pageSize: pageSizeEff,
        total,
      });
    });

    app.post(base, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const body = (req.body ?? {}) as DictRow;
      const code = String(body.code ?? "");
      const existing = await db
        .select({ code: cfg.code })
        .from(cfg.table)
        .where(eq(cfg.code, code));
      if (existing.length) return badRequest(reply, "编码已存在");
      const values: DictRow = {};
      for (const [k, v] of Object.entries(body)) {
        if (k in cols) values[k] = v;
      }
      values.code = code;
      values.name = String(body.name ?? "");
      values.sortOrder = Number(body.sortOrder ?? 0);
      values.createdAt = new Date().toISOString();
      values.updatedAt = new Date().toISOString();
      const inserted = await db
        .insert(cfg.table)
        .values(values as never)
        .returning();
      return reply.code(201).send(toDto(inserted[0] as DictRow, false));
    });

    app.put(`${base}/:code`, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const { code } = req.params as { code: string };
      const body = (req.body ?? {}) as DictRow;
      const existing = await db
        .select({ code: cfg.code })
        .from(cfg.table)
        .where(eq(cfg.code, code));
      if (!existing.length) return notFound(reply, "Entry not found");
      const patch: DictRow = { updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(body)) {
        if (k === "code" || k === "tenantId") continue;
        if (!(k in cols)) continue;
        patch[k] = v;
      }
      const updated = await db
        .update(cfg.table)
        .set(patch as never)
        .where(eq(cfg.code, code))
        .returning();
      return reply.send(updated[0] ? toDto(updated[0] as DictRow, false) : undefined);
    });

    app.delete(`${base}/:code`, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const { code } = req.params as { code: string };
      const deleted = await db
        .delete(cfg.table)
        .where(eq(cfg.code, code))
        .returning({ code: cfg.code });
      if (!deleted.length) return notFound(reply, "Entry not found");
      return reply.code(204).send();
    });
  };

  for (const family of Object.keys(CFGS) as Family[]) register(family);
}
