// src/db/client.ts — postgres-js + drizzle 单例。
// DATABASE_URL 必填 fail-fast（ADR-0019 禁 env 默认值兜底）。
// schema 来自 gen-shared file 通道（shared src/db/schema.ts 直拷）。
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "../lib/env-required.js";
import * as schema from "./schema.js";

const connectionString = requireEnv("DATABASE_URL");

// max 10：家族 dev 库 54321 连接预算（与 nextjs 侧同量级）
export const db = drizzle(postgres(connectionString, { max: 10 }), { schema });
