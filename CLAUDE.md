# CLAUDE.md — 标准规则服务

> 书稿配套仓 + harness 门禁仓双身份。入口，不是手册。L0 门强制上限 60 行。
> 本仓为《（书稿信息待补）》案例（待补）（标准规则服务）的可运行配套工程，是书稿代码块的 **source of truth**。

## 1. 项目定位

标准规则服务（`lab-management-system-rules`，技术栈 `node-service`）。一句话定位见 README.md。

## 2. 铁律

- **TDD**：每个模块先写失败测试 → 跑确认失败 → 实现 → 跑确认绿 → commit
- **版本钉死**：依赖与 `version-lock.json` 的 `version_lock` 一致；不引入 lock 外的库
- **tag 即放行**：全量回归绿后打 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`（如 `v0.3.54-20260826`）
- **mock-friendly**：安装 + 测试必须在无 Key、无 Docker、无网下全绿
- **功能清单是锚点**：改 `docs/functions/function-tree.md` 走 `/tree-change` 提案，由人批准；
  改功能与改功能清单必须同一个 commit；废弃只改状态，编号永不复用；禁止给 skip 的测试挂功能 ID

- 禁止 any 与 @ts-ignore（除非附 ADR 说明）
- 禁止 eval / new Function 等动态代码执行（公式引擎域反面目标，spec §3）
- 禁止 env 键写默认值兜底——SERVER_PORT / DATABASE_URL 缺值 fail-fast（suite-hard-rules §1）
- npm 依赖一律走 registry.npmmirror.com
- 禁止裸 console.log 进 src/ 业务面；日志经 fastify 实例 log
- 禁止绕过 shared 契约生成物手写 API 面（suite-hard-rules §4，契约接线批起）

## 3. 技术栈与版本（钉死于 version-lock.json）

Node 后端微服务（Fastify + TypeScript strict + Vitest 4 node 环境 + ESLint + Prettier）。trace 走 react-ts/angular 同款 fnTest/FnReporter：vitest.config.ts reporters 挂 tests/fnReporter.mjs，TRACE_MAP=1 时写 .state/trace.json，skip 测试 fns 源头抹空；tsconfig/vitest 配 @/* → src/* alias（家族引擎测试 import 面同构）。X18 槽：lab=5214（标准规则服务 lab-management-system-rules 首用，spec 2026-11-22-standard-rules-service-design.md）。env 键用家族统一 SERVER_PORT，缺值 startup fail-fast 禁默认兜底。npm 依赖一律走 registry.npmmirror.com。明细见 `version-lock.json` 与 README.md 技术栈表。

门禁命令见 `.harness/stack.json`。**不要改它来让门变松。**

## 4. 验收

- 在 **suite 根目录** 跑 `python scripts/gate.py -p lab-management-system-rules`；exit 0 才算完成
- 本地命令见 README.md「快速开始」

## 5. 指向别处

- 功能清单（唯一锚点） → `docs/functions/function-tree.md`
- 需求 → 任务 → 功能影响 → `docs/requirements/`
- 流程/设计 与功能对齐 → `docs/design/`（人评审，机器只查引用）
- 决策背景 → `docs/adr/`；编码细则 → `docs/conventions/`（不进主上下文）
- 待办与迭代方向 → `PLAN.md`；版本变更 → `CHANGELOG.md`

## 6. 工作循环

0. **开工前分诊**：先过 `using-skills`，把激活 skill 的清单落成 todo。
   顺序：规格(brainstorming)→计划(writing-plans)→测试先红(red-first)→实现(executing-plans)
1. 读 `.state/session.json` 恢复上下文
2. 最小改动
3. 跑 `python scripts/gate.py -p lab-management-system-rules`；exit 1 回到第 2 步；exit 2 停下问人
4. `/handoff` 更新 `.state/session.json`
