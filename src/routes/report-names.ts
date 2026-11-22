// M06.F07 报告名称域：CRUD + 三 links 族（object/standard/parameter）。
// 逐语义镜像 nextjs src/app/api/report-names/**：
// list Page 回显不切片 + keyword code/name 子串 + id=code 补列（wrapDict 形状）、
// create code/name 必填 400 + dup 400、PUT PATCH 语义（键集过滤 + updatedAt）、
// DELETE 204 幂等（plan R2 裁定，非 nextjs missing 404——CT 容 200/204）、
// links POST 204 幂等 upsert（onConflictDoNothing，nextjs 同款）、
// links DELETE @body 契约 + query 兼容双通道（全键匹配删，未命中也 204）。
import type { FastifyInstance } from "fastify";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import {
  inspectionReportNames,
  inspectionObjectReportNames,
  inspectionReportNameStandards,
  inspectionReportNameParameters,
} from "../db/schema.js";

type Row = Record<string, unknown>;

type FastifyLike = {
  code(status: number): { send(body?: unknown): unknown };
};

function toDto(row: Row): Row {
  const dto = { ...row };
  for (const k of Object.keys(dto)) {
    if (dto[k] === null || dto[k] === undefined) delete dto[k];
  }
  if (dto.id === undefined) dto.id = String(dto.code);
  return dto;
}

function badRequest(reply: FastifyLike, message: string) {
  return reply.code(400).send({ code: "BAD_REQUEST", message });
}

function notFound(reply: FastifyLike, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message });
}

export async function reportNameRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/api/report-names";
  const now = () => new Date().toISOString();

  app.get(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const keyword = q.keyword ?? "";
    const where = keyword
      ? sql`(strpos(${inspectionReportNames.code}::text, ${keyword}) > 0
            or strpos(${inspectionReportNames.name}::text, ${keyword}) > 0)`
      : undefined;
    const items = (await db.select().from(inspectionReportNames).where(where)).map((r) =>
      toDto(r as Row),
    );
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const pageSize = q.pageSize ? Number(q.pageSize) : items.length;
    return reply.send({ items, page, pageSize, total: items.length });
  });

  app.post(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const body = (req.body ?? {}) as Row;
    const code = String(body.code ?? "");
    if (!code || !body.name) return badRequest(reply, "code/name 必填");
    const dup = await db
      .select({ code: inspectionReportNames.code })
      .from(inspectionReportNames)
      .where(eq(inspectionReportNames.code, code));
    if (dup.length) return badRequest(reply, "报告名称编码已存在");
    const ts = now();
    const inserted = await db
      .insert(inspectionReportNames)
      .values({
        code,
        name: String(body.name),
        fullName: body.fullName ? String(body.fullName) : null,
        templatePath: body.templatePath ? String(body.templatePath) : null,
        summaryName: body.summaryName ? String(body.summaryName) : null,
        description: body.description ? String(body.description) : null,
        sortOrder: Number(body.sortOrder ?? 0),
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
      .from(inspectionReportNames)
      .where(eq(inspectionReportNames.code, code));
    if (!rows[0]) return notFound(reply, "ReportName not found");
    return reply.send(toDto(rows[0] as Row));
  });

  app.put(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    const body = (req.body ?? {}) as Row;
    // PATCH 语义 = nextjs updateReportNameDb：只覆盖给出字段，code/createdAt 不动
    const allowed = [
      "name",
      "fullName",
      "templatePath",
      "summaryName",
      "description",
      "sortOrder",
    ] as const;
    const sets: Row = { updatedAt: now() };
    for (const k of allowed) {
      if (k in body) sets[k] = body[k];
    }
    const updated = await db
      .update(inspectionReportNames)
      .set(sets as never)
      .where(eq(inspectionReportNames.code, code))
      .returning();
    if (!updated[0]) return notFound(reply, "ReportName not found");
    return reply.send(toDto(updated[0] as Row));
  });

  app.delete(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    // 幂等 204；links 三族由 FK onDelete cascade 级联删
    await db.delete(inspectionReportNames).where(eq(inspectionReportNames.code, code));
    return reply.code(204).send();
  });

  // ── links 三族 ────────────────────────────────────────────────
  const LINK_FAMILIES = {
    object: {
      table: inspectionObjectReportNames,
      deleteKeys: ["inspectionObjectCode", "reportNameCode"],
    },
    standard: {
      table: inspectionReportNameStandards,
      deleteKeys: ["reportNameCode", "inspectionStandardCode", "role"],
    },
    parameter: {
      table: inspectionReportNameParameters,
      deleteKeys: ["reportNameCode", "inspectionParameterCode"],
    },
  } as const;
  type Family = keyof typeof LINK_FAMILIES;

  for (const [family, cfg] of Object.entries(LINK_FAMILIES) as [
    Family,
    (typeof LINK_FAMILIES)[Family],
  ][]) {
    const PATH = `${BASE}/links/${family}`;
    const table = cfg.table;
    const cols = getTableColumns(table) as Record<string, PgColumn>;

    app.get(PATH, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const q = req.query as Record<string, string | undefined>;
      const conds: SQL[] = [];
      for (const key of cfg.deleteKeys) {
        const v = q[key];
        if (v) conds.push(eq(cols[key] as PgColumn, v));
      }
      const items = (
        await db
          .select()
          .from(table)
          .where(conds.length ? and(...conds) : undefined)
      ).map((r) => toDto(r as Row));
      // Page envelope 四字段（nextjs wrapLinks 镜像）：page 默认 1；
      // pageSize 默认 items.length（空集=0，2026-11-01 CT 收口禁 || 1 兜底）；不切片。
      const pageRaw = Number(q.page);
      const pageSizeRaw = Number(q.pageSize);
      return reply.send({
        items,
        total: items.length,
        page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
        pageSize:
          Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : items.length,
      });
    });

    app.post(PATH, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      const body = (req.body ?? {}) as Row;
      // 幂等 upsert 204（nextjs onConflictDoNothing 同款）
      await db
        .insert(table)
        .values(body as never)
        .onConflictDoNothing();
      return reply.code(204).send();
    });

    app.delete(PATH, async (req, reply) => {
      const auth = await requireTenant(req.headers.authorization, app.labJwt);
      if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
      // 契约 unlink 是 @body；query 兼容过渡期（双通道，全键匹配删）
      const b = (req.body ?? null) as Row | null;
      const hasBody = b && cfg.deleteKeys.every((k) => k in b);
      const source: Record<string, string | undefined> = hasBody
        ? (b as Record<string, string | undefined>)
        : (req.query as Record<string, string | undefined>);
      const conds: SQL[] = [];
      for (const key of cfg.deleteKeys) {
        const v = source[key];
        if (v) conds.push(eq(cols[key] as PgColumn, v));
      }
      if (conds.length) await db.delete(table).where(and(...conds));
      return reply.code(204).send();
    });
  }
}
