# Changelog

## [Unreleased]

### R1 骨架批（2026-11-22）

- 服务仓骨架（mold `node-service` profile init 正门产出：四门 L1-L4 + trace + common 资产 + docs 骨架）
- calc-engine 引擎内核搬入：`src/lib/calc-engine/{types,parser,functions,evaluate}.ts` + `tests/lib/calc-engine/engine.test.ts`——批 1/2/3a 产物 byte 级复制（`git diff --no-index` 全空），**复制非移动**：nextjs 本地内核与批 58 接线原地保留至 R3 判定切换批再退役
- 家族档案登记 X18=5214（`docs/families/lab.md` + `docs/conventions/multi-repo-family.md` §6 两处同 commit，spec 2026-11-22 人批落地）
- 依赖实装版（npmmirror，lock 入库钉版）：fastify 5.12.8 / typescript 6.0.3 / vitest 4.1.12 / eslint 9.39.4 / prettier 3.10.1 / tsx 4.23.15 / @types/node 22.20.5
- 骨架修（首批红回灌 mold 模板）：TS6 弃用 baseUrl 删除 / fnReporter.d.mts 类型声明 / fail-fast 输出改 process.stderr.write / eslint mjs node globals 定向补

### 挂账（禁顺手做，另批人批）

- R2：shared tsp 纯增 calc 两端点段（evaluate/records，人批）→ gen 产物 → 服务实现五域段+calc 段 + CT 增 `rules` target
- R3：四活前端录入页判定/求值切换（直调服务，result+verdict+formulaSnapshot 随保存）
- R4：四活前端维护页换数据源（CRUD 直调服务）+ react/vue/angular 运行时读切换
- R5：7 栈五域实现退役逐栈推进 + gen-shared marker 全家族刷新
- deploy 链后置：无 Dockerfile，`SERVER_PORT` 进 deploy 链时启用
