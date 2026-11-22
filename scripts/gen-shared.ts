// scripts/gen-shared.ts — shared 仓契约同步（家族两步 codegen，ADR-0025/0026 形状）
//
// API 层：shared/tsp → shared openapi.yaml → 本仓 src/gen/api-types.gen.ts
//         （openapi-typescript 类型产物，fastify handler 对拍用）
// DB 层：拷贝 shared src/db/schema.ts → 本仓 src/db/schema.ts
//        （DB-First 例外：rules 无 drizzle-kit，schema 直拷=家族 file 通道先例）
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sharedDir = resolve(root, "..", "lab-management-system-shared");

console.log("[gen-shared] step 1/3 — shared: emit OpenAPI.yaml...");
execSync("npm run emit:openapi", { cwd: sharedDir, stdio: "inherit" });

console.log("[gen-shared] step 2/3 — rules: openapi-typescript → src/gen/api-types.gen.ts");
mkdirSync(resolve(root, "src", "gen"), { recursive: true });
execSync(
  "npx --no -- openapi-typescript ../lab-management-system-shared/generated/openapi/openapi.yaml -o src/gen/api-types.gen.ts",
  { cwd: root, stdio: "inherit" },
);

console.log("[gen-shared] step 3/3 — rules: DB schema 拷贝 → src/db/schema.ts");
mkdirSync(resolve(root, "src", "db"), { recursive: true });
copyFileSync(resolve(sharedDir, "src", "db", "schema.ts"), resolve(root, "src", "db", "schema.ts"));

// ADR-0026 §2: last-gen-shared.json marker（同 sha 零写入，5.77）。
try {
  const sharedSha = execSync("git rev-parse HEAD", { cwd: sharedDir }).toString().trim();
  const markerPath = resolve(root, ".state", "last-gen-shared.json");
  mkdirSync(resolve(root, ".state"), { recursive: true });

  let marker: Record<string, unknown> = {};
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    /* 首次写 */
  }

  if (marker["api_synced_sha"] === sharedSha && marker["db_synced_sha"] === sharedSha) {
    console.log(`[gen-shared]    marker sha 未变，零写入: ${markerPath}`);
  } else {
    const now = new Date().toISOString();
    marker["api_synced_sha"] = sharedSha;
    marker["api_synced_at"] = now;
    marker["db_synced_sha"] = sharedSha;
    marker["db_synced_at"] = now;
    marker["api_synced_cmd"] = "gen-shared.ts";
    marker["shared_sha"] = sharedSha;
    marker["consumer_repo"] = "lab-management-system-rules";
    writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n");
    console.log(`[gen-shared]    marker 已落盘: ${markerPath} (shared HEAD ${sharedSha.slice(0, 7)})`);
  }
} catch (err) {
  console.log(
    `[gen-shared]    WARN: marker 写失败——跳过（staleness 将报 UNKNOWN）: ${err instanceof Error ? err.message : err}`,
  );
}

console.log("[gen-shared] OK");
