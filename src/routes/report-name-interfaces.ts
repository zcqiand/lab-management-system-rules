// M06.F09 报告名称扩展属性界面域：CRUD + link/unlink。逐语义镜像 nextjs
// src/app/api/report-name-interfaces/** + db-queries interfaceDict 族：
// list Page 回显不切片（page/pageSize 仅回显，items 全量）、keyword
// code/name 子串、create dup→400 CONFLICT、config 缺省 {}、version 服务端
// 缺省 1、PUT PATCH 语义、DELETE 204（FK cascade 级联删 links）且 missing→404、
// links POST 201 + dup 400「关联已存在」（dup 判定 2 键）、links DELETE 204 幂等
// ——均 nextjs 逐字面（终审 I-1/I-2 修正，plan 初稿「幂等 204 upsert」系语义
// 误记，已废）。
import type { FastifyInstance } from "fastify";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { requireTenant } from "../lib/auth/require-tenant.js";
import {
  inspectionReportNameInterfaceLinks,
  inspectionReportNameInterfaces,
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

export async function reportNameInterfaceRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/api/report-name-interfaces";
  const now = () => new Date().toISOString();

  app.get(BASE, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const keyword = q.keyword?.trim();
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const where = keyword
      ? sql`(strpos(${inspectionReportNameInterfaces.code}::text, ${keyword}) > 0
            or strpos(${inspectionReportNameInterfaces.name}::text, ${keyword}) > 0)`
      : undefined;
    const items = (
      await db.select().from(inspectionReportNameInterfaces).where(where)
    ).map((r) => toDto(r as Row));
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
      .select({ code: inspectionReportNameInterfaces.code })
      .from(inspectionReportNameInterfaces)
      .where(eq(inspectionReportNameInterfaces.code, code));
    if (dup.length) {
      return reply
        .code(400)
        .send({ code: "CONFLICT", message: "报告名称界面编码已存在" });
    }
    const ts = now();
    const inserted = await db
      .insert(inspectionReportNameInterfaces)
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
      .from(inspectionReportNameInterfaces)
      .where(eq(inspectionReportNameInterfaces.code, code));
    if (!rows[0]) return notFound(reply, "ReportNameInterface not found");
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
      .update(inspectionReportNameInterfaces)
      .set(vals as never)
      .where(eq(inspectionReportNameInterfaces.code, code))
      .returning();
    if (!updated[0]) return notFound(reply, "ReportNameInterface not found");
    return reply.send(toDto(updated[0] as Row));
  });

  app.delete(`${BASE}/:code`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const { code } = req.params as { code: string };
    // 204；links 由 FK onDelete cascade 级联删；missing→404（nextjs 逐字面，
    // 终审 I-1 修正）
    const deleted = await db
      .delete(inspectionReportNameInterfaces)
      .where(eq(inspectionReportNameInterfaces.code, code))
      .returning();
    if (!deleted[0]) return notFound(reply, "报告名称界面不存在");
    return reply.code(204).send();
  });

  // ── links：报告名称↔界面（M06.F09.I06/I07）──────────────────────────────
  app.get(`${BASE}/links`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    const q = req.query as Record<string, string | undefined>;
    const conds: SQL[] = [];
    if (q.reportNameCode)
      conds.push(eq(inspectionReportNameInterfaceLinks.reportNameCode, q.reportNameCode));
    if (q.reportNameInterfaceCode)
      conds.push(
        eq(
          inspectionReportNameInterfaceLinks.reportNameInterfaceCode,
          q.reportNameInterfaceCode,
        ),
      );
    const items = (
      await db
        .select()
        .from(inspectionReportNameInterfaceLinks)
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
    if (!body.reportNameCode || !body.reportNameInterfaceCode) {
      return badRequest(reply, "reportNameCode/reportNameInterfaceCode 必填");
    }
    const values = {
      reportNameCode: String(body.reportNameCode),
      reportNameInterfaceCode: String(body.reportNameInterfaceCode),
      createdAt: now(),
      updatedAt: now(),
    };
    // dup 判定 2 键 = PG PK（reportName+iface，镜像 nextjs createInterfaceLinkDb）；
    // fresh → 201 行；dup → 400「关联已存在」（终审 I-2 修正，nextjs 逐字面）
    const dup = await db
      .select({ reportNameCode: inspectionReportNameInterfaceLinks.reportNameCode })
      .from(inspectionReportNameInterfaceLinks)
      .where(
        and(
          eq(inspectionReportNameInterfaceLinks.reportNameCode, values.reportNameCode),
          eq(
            inspectionReportNameInterfaceLinks.reportNameInterfaceCode,
            values.reportNameInterfaceCode,
          ),
        ),
      );
    if (dup.length) return badRequest(reply, "关联已存在");
    const inserted = await db
      .insert(inspectionReportNameInterfaceLinks)
      .values(values)
      .returning();
    return reply.code(201).send(toDto(inserted[0] as Row));
  });

  app.delete(`${BASE}/links`, async (req, reply) => {
    const auth = await requireTenant(req.headers.authorization, app.labJwt);
    if ("statusCode" in auth) return reply.code(auth.statusCode).send(auth.body);
    // 契约 unlink 是 @body；query 兼容过渡期（镜像 nextjs 双通道）
    let reportNameCode = "";
    let interfaceCode = "";
    const b = (req.body ?? null) as Row | null;
    if (b && (b.reportNameCode || b.reportNameInterfaceCode)) {
      reportNameCode = String(b.reportNameCode ?? "");
      interfaceCode = String(b.reportNameInterfaceCode ?? "");
    } else {
      const q = req.query as Record<string, string | undefined>;
      reportNameCode = q.reportNameCode ?? "";
      interfaceCode = q.reportNameInterfaceCode ?? "";
    }
    await db
      .delete(inspectionReportNameInterfaceLinks)
      .where(
        and(
          eq(inspectionReportNameInterfaceLinks.reportNameCode, reportNameCode),
          eq(inspectionReportNameInterfaceLinks.reportNameInterfaceCode, interfaceCode),
        ),
      );
    return reply.code(204).send();
  });
}
