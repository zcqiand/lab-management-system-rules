import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fnTest } from "../fn.js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import { inspectionParamInterfaces, inspectionParamInterfaceLinks } from "@/db/schema.js";
import { buildApp } from "@/app.js";
import type { FastifyInstance } from "fastify";

// fn: M06.F08.I01-I06 参数界面域（Task 6）
// 数据面：lab_test 真库（setup-env 注入）；自建 unique 行 + 收尾清理。
// links FK 需要 IP-0001（shared 种子现行行）作合法参数码。

const app: FastifyInstance = await buildApp();
const token = await app.labJwt.issue("test-user", "tenant-A");
const authz = { authorization: `Bearer ${token}` };

const CODES = ["R2-PI-A", "R2-PI-B", "R2-PI-C"];
const CLEANUP_CODES = [...CODES, "R2-PI-NEW"];
const LINK_PARAM = "IP-0001";

async function cleanup() {
  for (const code of CLEANUP_CODES) {
    await db
      .delete(inspectionParamInterfaceLinks)
      .where(eq(inspectionParamInterfaceLinks.paramInterfaceCode, code));
    await db
      .delete(inspectionParamInterfaces)
      .where(eq(inspectionParamInterfaces.code, code));
  }
}

beforeAll(async () => {
  await cleanup();
  for (const [i, code] of CODES.entries()) {
    await db.insert(inspectionParamInterfaces).values({
      code,
      name: `R2 参数界面 ${i + 1}`,
      description: "",
      version: 1,
      config: {},
    });
  }
  await db.insert(inspectionParamInterfaceLinks).values({
    inspectionParameterCode: LINK_PARAM,
    paramInterfaceCode: "R2-PI-A",
  });
});

afterAll(async () => {
  await cleanup();
  await app.close();
});

describe("GET /api/param-interfaces", () => {
  fnTest(["M06.F08.I01"], "list 回显不切片（pageSize=1 items 仍全量）", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/param-interfaces?page=1&pageSize=1",
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
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  fnTest(["M06.F08.I01"], "keyword code/name 模糊", async () => {
    const byCode = await app.inject({
      method: "GET",
      url: "/api/param-interfaces?keyword=R2-PI",
      headers: authz,
    });
    expect(byCode.statusCode).toBe(200);
    const items = byCode.json().items as Array<{ code: string; name: string }>;
    expect(items.filter((r) => CODES.includes(r.code))).toHaveLength(3);
    const byName = await app.inject({
      method: "GET",
      url: "/api/param-interfaces?keyword=" + encodeURIComponent("参数界面 2"),
      headers: authz,
    });
    expect(byName.statusCode).toBe(200);
    const named = byName.json().items as Array<{ code: string; name: string }>;
    expect(named.some((r) => r.code === "R2-PI-B")).toBe(true);
    expect(named.every((r) => r.name.includes("参数界面 2"))).toBe(true);
  });
});

describe("POST /api/param-interfaces", () => {
  fnTest(["M06.F08.I03"], "缺 code → 400 BAD_REQUEST 信封", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/param-interfaces",
      headers: authz,
      payload: { name: "无码行" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
  });

  fnTest(["M06.F08.I03"], "config 默认 {}、version 默认 1；重复 code → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/param-interfaces",
      headers: authz,
      payload: { code: "R2-PI-NEW", name: "R2 新界面" },
    });
    expect(res.statusCode).toBe(201);
    const row = res.json();
    expect(row.code).toBe("R2-PI-NEW");
    expect(row.version).toBe(1);
    expect(row.config).toEqual({});
    const dup = await app.inject({
      method: "POST",
      url: "/api/param-interfaces",
      headers: authz,
      payload: { code: "R2-PI-NEW", name: "重复" },
    });
    expect(dup.statusCode).toBe(400);
    expect(dup.json().code).toBe("CONFLICT");
  });
});

describe("GET/PUT/DELETE /api/param-interfaces/{code}", () => {
  fnTest(["M06.F08.I02"], "详情含 config；missing → 404 NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/param-interfaces/R2-PI-A",
      headers: authz,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toBe("R2-PI-A");
    expect(res.json().config).toEqual({});
    const miss = await app.inject({
      method: "GET",
      url: "/api/param-interfaces/R2-PI-MISSING",
      headers: authz,
    });
    expect(miss.statusCode).toBe(404);
    expect(miss.json().code).toBe("NOT_FOUND");
  });

  fnTest(["M06.F08.I04"], "PUT PATCH 语义：改 name 保留 config", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/param-interfaces/R2-PI-A",
      headers: authz,
      payload: { name: "R2 改名界面" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("R2 改名界面");
    expect(res.json().config).toEqual({});
  });
});

describe("DELETE + links", () => {
  fnTest(
    ["M06.F08.I05"],
    "DELETE → 204；missing → 404（终审 I-1 修正）+ 级联删 links",
    async () => {
      const pre = await app.inject({
        method: "GET",
        url: "/api/param-interfaces/R2-PI-A",
        headers: authz,
      });
      expect(pre.statusCode).toBe(200);
      const res = await app.inject({
        method: "DELETE",
        url: "/api/param-interfaces/R2-PI-A",
        headers: authz,
      });
      expect(res.statusCode).toBe(204);
      const again = await app.inject({
        method: "DELETE",
        url: "/api/param-interfaces/R2-PI-A",
        headers: authz,
      });
      expect(again.statusCode).toBe(404);
      expect(again.json()).toEqual({ code: "NOT_FOUND", message: "参数界面不存在" });
      const links = await db
        .select()
        .from(inspectionParamInterfaceLinks)
        .where(eq(inspectionParamInterfaceLinks.paramInterfaceCode, "R2-PI-A"));
      expect(links).toHaveLength(0);
    },
  );

  fnTest(
    ["M06.F08.I06"],
    "links POST 201 + dup 400（终审 I-2 修正）+ DELETE 幂等",
    async () => {
      const payload = {
        inspectionParameterCode: LINK_PARAM,
        paramInterfaceCode: "R2-PI-B",
      };
      const r1 = await app.inject({
        method: "POST",
        url: "/api/param-interfaces/links",
        headers: authz,
        payload,
      });
      expect(r1.statusCode).toBe(201);
      expect(r1.json().inspectionParameterCode).toBe(LINK_PARAM);
      const r2 = await app.inject({
        method: "POST",
        url: "/api/param-interfaces/links",
        headers: authz,
        payload,
      });
      expect(r2.statusCode).toBe(400);
      expect(r2.json()).toEqual({ code: "BAD_REQUEST", message: "关联已存在" });
      const rows = await db
        .select()
        .from(inspectionParamInterfaceLinks)
        .where(eq(inspectionParamInterfaceLinks.paramInterfaceCode, "R2-PI-B"));
      expect(rows).toHaveLength(1);
      const del = await app.inject({
        method: "DELETE",
        url: "/api/param-interfaces/links",
        headers: authz,
        payload,
      });
      expect(del.statusCode).toBe(204);
      const delAgain = await app.inject({
        method: "DELETE",
        url: "/api/param-interfaces/links",
        headers: authz,
        payload,
      });
      expect(delAgain.statusCode).toBe(204);
    },
  );
});

describe("401 全域", () => {
  // 工程设施测试不挂业务 fn-ID（fn.ts 纪律）
  it("无 token → UNAUTHORIZED 信封逐字面", async () => {
    const res = await app.inject({ method: "GET", url: "/api/param-interfaces" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "tenant_id claim is required (ADR-0019)",
    });
  });
});
