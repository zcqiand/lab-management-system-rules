# Changelog

## [Unreleased]

### R1 骨架批（2026-11-22）

- 服务仓骨架（mold `node-service` profile init 正门产出：四门 L1-L4 + trace + common 资产 + docs 骨架）
- calc-engine 引擎内核搬入：`src/lib/calc-engine/{types,parser,functions,evaluate}.ts` + `tests/lib/calc-engine/engine.test.ts`——批 1/2/3a 产物 byte 级复制（`git diff --no-index` 全空），**复制非移动**：nextjs 本地内核与批 58 接线原地保留至 R3 判定切换批再退役
- 家族档案登记 X18=5214（`docs/families/lab.md` + `docs/conventions/multi-repo-family.md` §6 两处同 commit，spec 2026-11-22 人批落地）
- 依赖实装版（npmmirror，lock 入库钉版）：fastify 5.12.8 / typescript 6.0.3 / vitest 4.1.12 / eslint 9.39.4 / prettier 3.10.1 / tsx 4.23.15 / @types/node 22.20.5
- 骨架修（首批红回灌 mold 模板）：TS6 弃用 baseUrl 删除 / fnReporter.d.mts 类型声明 / fail-fast 输出改 process.stderr.write / eslint mjs node globals 定向补

### deploy 链（2026-11-22，用户指令翻转 spec 裁量 5）

- deploy 四件套（lab-go 先例形状适配 node-service）：`Dockerfile`（node:22-alpine 单段 + tsx 直跑 TS + HEALTHCHECK `wget -q -O /dev/null http://127.0.0.1:5214/healthz` 真拉 GET + EXPOSE 5214 + SERVER_PORT 禁镜像 ENV 兜底）/ `.github/workflows/ci.yml`（test=四门 `npx --no --` 同款 + 镜像装配冒烟 /healthz 200 + POST 405 守卫；deploy=tag 触发 latest+tag 双份 → VPS 脚本）/ `deploy/lab-management-system-rules.sh`（rules.env 自举 .env.example 全集 2 key，DATABASE_URL 由 PG_HOST/PG_PASSWORD 合成 lab_prod）/ `deploy/nginx-vps.conf.example`（lab-rules.xiangru.uk → 127.0.0.1:5214，老 listen 参数语法）
- 首航 tag `v0.1.0-20261122`；secrets 7 件（DOCKER_USERNAME/PASSWORD、VPS_HOST/USER/SSH_KEY、PG_HOST/PG_PASSWORD）
- 本机无 docker——装配冒烟由 CI test job 承担（lab-go 同款姿态）

### 挂账（禁顺手做，另批人批）

- R2：shared tsp 纯增 calc 两端点段（evaluate/records，人批）→ gen 产物 → 服务实现五域段+calc 段 + CT 增 `rules` target
- R3：四活前端录入页判定/求值切换（直调服务，result+verdict+formulaSnapshot 随保存）
- R4：四活前端维护页换数据源（CRUD 直调服务）+ react/vue/angular 运行时读切换
- R5：7 栈五域实现退役逐栈推进 + gen-shared marker 全家族刷新
