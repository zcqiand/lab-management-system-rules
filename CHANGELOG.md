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
- 首航 tag `v0.1.0-20261122`；secrets 7 件（DOCKER_USERNAME/PASSWORD、VPS_HOST/USER/SSH_KEY、PG_HOST/PG_PASSWORD）；run 45014824821 全绿，`https://lab-rules.xiangru.uk/healthz` → `{"ok":true}` 200 + POST 404 live 实证
- 首航三指纹（三 run 实付）：CI test job 漏 `npm ci`（npx 无 node_modules 假红，run 45014385926）/ 冒烟容器漏 `-p 127.0.0.1:5214:5214` 端口发布（容器内 HEALTHCHECK 200 蒙混，宿主 curl 摸不进，run 45014475098）/ POST 守卫 405→404（Fastify 未匹配方法默认 404，405 是 go/net-http ServeMux 语义勿混抄，run 45014683832）
- 本机无 docker——装配冒烟由 CI test job 承担（lab-go 同款姿态）

### R2 五域段 + calc 段（2026-11-22，spec §5 R2 / REQ-2026-043）

- calc-engine 增补：ENGINE_FUNCTIONS 注册 `avg`（算术均值，spec §3.2 只增不改；
  brief 用例①公式形状 `avg(R1,R2,R3)` 逐字；空参 NaN 由求值器 non-finite→null 兜）
- calc 段（commit 1b8c5e6）：`POST /api/calc/evaluate`（引擎内核直通 + techReq 服务侧
  autoVerdict，nextjs cement-strength 语义镜像）+ `GET /api/calc/records/:recordId`
  （只读复现链：record tenant 收口 → method 行 param+std obj 升序首个 → ext 数值键
  单组复算 → techReq verified 优先 → verdict；不落库——R2 裁定）
- 五域段（Task 4-10）：auth / catalog 四族 / param-interfaces / report-names（+三
  links 族 Page envelope）/ report-name-interfaces / technical-requirements（8 键
  PK 哨兵寻址）/ calculation-methods（R6-1 升序首个）逐域 TDD 落地（各域独立 commit）
- CT live 收口（commit 4f03b92）：①app.ts 空 body + json content-type 宽容 parser
  （Fastify FST_ERR_CTP_EMPTY_JSON_BODY 与家族 springboot/aspnetcore/go 宽容语义
  分叉——rules 首个 Node/Fastify 后端实付指纹）；②report-names 三 links GET 补
  Page envelope 四字段（nextjs wrapLinks 镜像，空集 pageSize=0 禁 ||1 兜底）；
  ③calc.test.ts OBJ_B 换专属行（种子行与兄弟测试同三键 PK，vitest 并行互撞假红）
- 验证：rules 仓 100/100 双跑全绿 + gate exit 0；CT live 五域+calc 13 文件 138/138
  （CONTRACT_TARGETS=nextjs,rules 双打）；CT gate exit 0（trace mode=live
  executed_per_describe_min=2）
- 兄弟仓同步清单：contract-test（五域重定向+calc 用例+tr-write 净场，照单回放✓）；
  shared（calc 契约 tsp 纯增段，待 I 行 --approve 后一并 commit）

### 挂账（禁顺手做，另批人批）

- 树落地回填批（阻塞用户三件）：①shared 第二次 `--approve`（I 行 M06.F10.I01/I02）
  → shared function-tree.md 补 I 行 → shared 全门 commit（连同 main.tsp/openapi.yaml/
  F 行）→ rules mirror `--apply` → rules calc.test.ts 补 fnTest 锚 + trace 重生成 +
  全门独立 commit；②`scripts/gate.py:115` ALL_TIER_UNIT_OVERRIDES 加 5214（hook 拦
  模型，人改）；③CT `.harness/stack.json` trace_env 加 `,rules`（同上人改）
- CT calc 用例 live trace 映射（随回填批）：calc 单目标 rules（nextjs 无 calc 面），
  live-floor executed_per_describe=1 结构性塌缩——回填时须与 nextjs calc 面（R3+）
  或 floor 豁免裁定一并解
- auth 域 live 分叉（Class C，R1 面 2026-11-22 live 首次暴露）：login normalize /
  auth-write refresh/sso-callback/switch-tenant/logout / auth-read permissions/menus/
  sso-authorize rules 面失败——另批
- rules 未实现域 CT 文件（Class A）：receipts/samples/dictionary/contracts/
  test-records 等打 rules 全 404——R3+ 收敛
- R3：四活前端录入页判定/求值切换（直调服务，result+verdict+formulaSnapshot 随保存）+ nextjs calc 面另批
- R4：四活前端维护页换数据源（CRUD 直调服务）+ react/vue/angular 运行时读切换
- R5：7 栈五域实现退役逐栈推进 + gen-shared marker 全家族刷新
