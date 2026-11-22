import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fnTest } from "../fn.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  inspectionBrands,
  inspectionGrades,
  inspectionModels,
  inspectionSpecs,
} from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// fn: M04.F09.I01-I04（brands 族）——models/specs/grades 同构（Task 5）
// 数据面：lab_test 真库（setup-env 注入）；自建 unique 行 + 收尾清理。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };

const CODES = ["R2-BRAND-A", "R2-BRAND-B", "R2-BRAND-C"];

async function cleanup() {
  for (const code of CODES) {
    await db.delete(inspectionBrands).where(eq(inspectionBrands.code, code));
  }
}

beforeAll(async () => {
  await cleanup();
  for (const [i, code] of CODES.entries()) {
    await db.insert(inspectionBrands).values({
      code,
      name: `R2 测试牌号 ${i + 1}`,
      sortOrder: 9000 + i,
      inspectionObjectCode: null,
    });
  }
});

afterAll(async () => {
  await cleanup();
  await app.close();
});

describe("GET /api/catalog/brands", () => {
  fnTest(["M04.F09.I01"], "list Page 四字段 + id=code 补列", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog/brands",
      headers: authz,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("total");
    const mine = body.items.filter((r: { code: string }) => CODES.includes(r.code));
    expect(mine).toHaveLength(3);
    for (const row of mine) expect(row.id).toBe(row.code);
  });

  fnTest(
    ["M04.F09.I01"],
    "LIMIT/OFFSET 真切片（page=2&pageSize=2；nextjs 实证镜像）",
    async () => {
      const all = await app.inject({
        method: "GET",
        url: "/api/catalog/brands",
        headers: authz,
      });
      const total = all.json().total as number;
      const res = await app.inject({
        method: "GET",
        url: "/api/catalog/brands?page=2&pageSize=2",
        headers: authz,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toHaveLength(Math.min(2, Math.max(0, total - 2)));
      expect(body.page).toBe(2);
      expect(body.pageSize).toBe(2);
      expect(body.total).toBe(total);
    },
  );

  fnTest(["M04.F09.I01"], "inspectionObjectCode 直列过滤；keyword 静默忽略", async () => {
    const filtered = await app.inject({
      method: "GET",
      url: "/api/catalog/brands?inspectionObjectCode=R2-NO-SUCH-OBJECT",
      headers: authz,
    });
    expect(filtered.json().items).toHaveLength(0);
    const kw = await app.inject({
      method: "GET",
      url: "/api/catalog/brands?keyword=R2-BRAND-A",
      headers: authz,
    });
    const bare = await app.inject({
      method: "GET",
      url: "/api/catalog/brands",
      headers: authz,
    });
    expect(kw.json().total).toBe(bare.json().total);
    expect(kw.json().items).toHaveLength(bare.json().items.length);
  });
});

describe("POST /api/catalog/brands", () => {
  fnTest(["M04.F09.I02"], "create → 201 返回行", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/brands",
      headers: authz,
      payload: { code: "R2-BRAND-NEW", name: "R2 新牌号", sortOrder: 9999 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("R2-BRAND-NEW");
    // 收尾清理
    await db.delete(inspectionBrands).where(eq(inspectionBrands.code, "R2-BRAND-NEW"));
  });

  fnTest(["M04.F09.I02"], "重复 code → 400 编码已存在", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/brands",
      headers: authz,
      payload: { code: "R2-BRAND-A", name: "dup" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });
});

describe("PUT /api/catalog/brands/{code}", () => {
  fnTest(["M04.F09.I03"], "PATCH 语义：只传 name，其余列不变", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/catalog/brands/R2-BRAND-A",
      headers: authz,
      payload: { name: "R2 改名" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("R2 改名");
    expect(body.sortOrder).toBe(9000);
    expect(body.inspectionObjectCode).toBeUndefined();
  });

  fnTest(["M04.F09.I03"], "404 信封（不存在的 code）", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/catalog/brands/R2-NO-SUCH",
      headers: authz,
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/catalog/brands/{code}", () => {
  fnTest(
    ["M04.F09.I04"],
    "204 → 二次 404（nextjs 镜像：missing=404 Entry not found）",
    async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/catalog/brands/R2-BRAND-C",
        headers: authz,
      });
      expect(res.statusCode).toBe(204);
      const res2 = await app.inject({
        method: "DELETE",
        url: "/api/catalog/brands/R2-BRAND-C",
        headers: authz,
      });
      expect(res2.statusCode).toBe(404);
      expect(res2.json().code).toBe("NOT_FOUND");
    },
  );

  // CT live axios 形状（client() 默认全请求带 content-type: application/json）：
  // DELETE 无 body + json CT 必须到达路由处理（404 NOT_FOUND），
  // 不得 Fastify 框架级 400 FST_ERR_CTP_EMPTY_JSON_BODY——家族后端
  // （springboot/aspnetcore/go 对此均宽容 2xx/404）语义对齐，2026-11-22 live 实证。
  it("空 body + json content-type → 到达路由（404 NOT_FOUND 非 400）", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/brands/R2-CT-EMPTY-JSON",
      headers: { ...authz, "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });
});

describe("401 全域", () => {
  // 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
  it("无 token → UNAUTHORIZED 信封逐字面", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/brands" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "tenant_id claim is required (ADR-0019)",
    });
  });
});

describe("models/specs/grades 三族同构冒烟", () => {
  const TABLES = {
    models: inspectionModels,
    specs: inspectionSpecs,
    grades: inspectionGrades,
  } as const;

  for (const [family, table] of Object.entries(TABLES)) {
    fnTest(
      [`M04.${{ models: "F06", specs: "F07", grades: "F08" }[family!]}.I01`],
      `${family}: list + id=code 补列 同构`,
      async () => {
        const code = `R2-${family!.toUpperCase()}-SMOKE`;
        await db.delete(table).where(eq(table.code, code));
        await db
          .insert(table)
          .values({ code, name: `R2 ${family} 冒烟`, sortOrder: 9500 });
        try {
          const res = await app.inject({
            method: "GET",
            url: `/api/catalog/${family}`,
            headers: authz,
          });
          expect(res.statusCode).toBe(200);
          const row = res.json().items.find((r: { code: string }) => r.code === code);
          expect(row?.id).toBe(code);
        } finally {
          await db.delete(table).where(eq(table.code, code));
        }
      },
    );
  }
});
