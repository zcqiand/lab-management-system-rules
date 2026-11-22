# 功能清单（Function Tree）— 标准规则服务

> **全体系唯一锚点。** 非本仓实现的功能可引用家族 shared BASE 树；本仓树只登记本仓交付面。
> 不在这里的 ID 是悬空引用，L5 门会拦。**改功能，先改这份表。**

## 编号规则

| 层级 | 名称 | 格式 | 含义 |
|---|---|---|---|
| 一级 | 功能模块 | `M0x` | 业务域边界，通常对应一级菜单（实际命名见各仓模块总览） |
| 二级 | 功能 | `M0x.F0y` | 一个完整业务步骤 / 独立闭环流程 / 数据管理页面 |
| 三级 | 功能子项 | `M0x.F0y.I0z` | 技术交付单元 / 权限挂载点。对应一个 API 接口、页面组件、图表区块或权限控制点 |

**硬规则**

1. 编号单调递增，永不复用。废弃改状态，不删行。
2. 子项编号必须以父级为前缀。
3. 一个子项 = 一个权限点。权限码即 ID，不另起一套编码。
4. 拆不出子项的功能 → 它其实是子项，往上并。子项超 20 个 → 它其实是模块，往下拆。

**状态**：`规划` | `开发中` | `已上线` | `已废弃`
**子项类型**：`页面` | `标签页` | `查询` | `按钮` | `报表` | `接口`
**交付**：`前端+后端` | `仅前端` | `仅后端` | `后端`

---

## 模块总览

| 模块 ID | 模块名称 | 说明 | 状态 |
|---|---|---|---|
| M00 | 租户管理 | 当前用户关联租户列表、登录选租户、切换租户 | 开发中 |
| M01 | 认证管理 | 权限管理（RBAC/路由守卫/动态菜单）、认证（登录/SSO/JWT） | 开发中 |
| M04 | 基础数据 | 型号/规格/等级/牌号维护 | 开发中 |
| M06 | 检测能力 | 检测专项/项目/参数/标准/计算方法/技术要求/报告名称/参数界面 | 开发中 |

---

## M00 租户管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M00.F01 | 当前用户会话 | 当前用户信息 + 关联租户列表 + 当前选中租户（GET /auth/me） | 开发中 |

### M00.F01 当前用户会话

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M00.F01.I01 | 当前会话 | 接口 | 前端+后端 | GET /api/auth/me：user + 关联租户列表 + currentTenantId（token tenant_id claim，缺省 TENANT-001） | 开发中 |

---

## M01 认证管理

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M01.F01 | （待填） | | 规划 |
| M01.F05 | 认证管理 | OAuth 2.0 授权码 SSO（client_secret 后端持）+ lab 自家 JWT 签发，saas token 不出 lab 后端 | 开发中 |

### M01.F01 （待填）

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M01.F01.I01 | （待填） | 查询 | 后端 | | 规划 |

### M01.F05 认证管理

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M01.F05.I01 | 密码登录 | 接口 | 前端+后端 | POST /api/auth/login：用户名+密码校验，签发 access/refresh token + 租户列表。**2026-09-17 标记 已废弃**（SSO M01.F05.I02/I03 替代）；tsp op 暂留，9 仓 ServiceLogin/live_smoke/contract-test 13 注解迁移完成后一并删 op + LoginRequest/Response model | 已废弃 |
| M01.F05.I06 | 原生登录 | 接口 | 前端+后端 | POST /api/auth/native-login：非浏览器客户端（iOS/Android 原生表单）密码通道，REQ-2026-003 Q4-C 人裁（2026-09-28，非恢复已废弃 I01 web 密码端点）；REQ-2026-023 变更（2026-10-11 人裁方案 A）：校验委托 saas IdP 代理——请求体账密调 saas /api/v1/auth/login（clientId=lab-management），lab 自家 JWT 重签与 LoginResponse 契约形状不变，LAB_AUTH_DEV_PASSWORD 全家族退役 | 开发中 |

---

## M04 基础数据

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M04.F06 | 型号维护 | InspectionModel 实体码表维护，列表按检测专项过滤 | 开发中 |
| M04.F07 | 规格维护 | InspectionSpec 实体码表维护，列表按检测专项过滤 | 开发中 |
| M04.F08 | 等级维护 | InspectionGrade 实体码表维护，列表按检测专项过滤 | 开发中 |
| M04.F09 | 牌号维护 | InspectionBrand 实体码表维护，列表按检测专项过滤 | 开发中 |

### M04.F06 型号维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F06.I01 | 型号列表 | 接口 | 前端+后端 | GET /api/catalog/models?page=&pageSize=&inspectionObjectCode=&keyword=：`Page<InspectionModel>`，按 tenant 收口 + 2 过滤 | 开发中 |
| M04.F06.I02 | 创建型号 | 接口 | 前端+后端 | POST /api/catalog/models：body CreateCatalogEntryRequest（code/name 必填 + 可选 inspectionObjectCode/remark/sortOrder），返回 InspectionModel | 开发中 |
| M04.F06.I03 | 更新型号 | 接口 | 前端+后端 | PUT /api/catalog/models/{code}：body UpdateCatalogEntryRequest（PATCH 语义，未传字段保留），404 if 不存在 | 开发中 |
| M04.F06.I04 | 删除型号 | 接口 | 前端+后端 | DELETE /api/catalog/models/{code}：204；FK 被 technical_requirements.model 引用时 DB SET NULL | 开发中 |

### M04.F07 规格维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F07.I01 | 规格列表 | 接口 | 前端+后端 | GET /api/catalog/specs?page=&pageSize=&inspectionObjectCode=&keyword=：`Page<InspectionSpec>` | 开发中 |
| M04.F07.I02 | 创建规格 | 接口 | 前端+后端 | POST /api/catalog/specs | 开发中 |
| M04.F07.I03 | 更新规格 | 接口 | 前端+后端 | PUT /api/catalog/specs/{code} | 开发中 |
| M04.F07.I04 | 删除规格 | 接口 | 前端+后端 | DELETE /api/catalog/specs/{code} | 开发中 |

### M04.F08 等级维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F08.I01 | 等级列表 | 接口 | 前端+后端 | GET /api/catalog/grades?page=&pageSize=&inspectionObjectCode=&keyword=：`Page<InspectionGrade>` | 开发中 |
| M04.F08.I02 | 创建等级 | 接口 | 前端+后端 | POST /api/catalog/grades | 开发中 |
| M04.F08.I03 | 更新等级 | 接口 | 前端+后端 | PUT /api/catalog/grades/{code} | 开发中 |
| M04.F08.I04 | 删除等级 | 接口 | 前端+后端 | DELETE /api/catalog/grades/{code} | 开发中 |

### M04.F09 牌号维护

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M04.F09.I01 | 牌号列表 | 接口 | 前端+后端 | GET /api/catalog/brands?page=&pageSize=&inspectionObjectCode=&keyword=：`Page<InspectionBrand>` | 开发中 |
| M04.F09.I02 | 创建牌号 | 接口 | 前端+后端 | POST /api/catalog/brands | 开发中 |
| M04.F09.I03 | 更新牌号 | 接口 | 前端+后端 | PUT /api/catalog/brands/{code} | 开发中 |
| M04.F09.I04 | 删除牌号 | 接口 | 前端+后端 | DELETE /api/catalog/brands/{code} | 开发中 |

---

## M06 检测能力

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M06.F04 | 检测标准 | InspectionStandard CRUD（含状态：active/superseded/draft） | 开发中 |
| M06.F05 | 计算方法 | CalculationMethod 维护（复合主键，算法类型 + 公式） | 开发中 |
| M06.F06 | 技术要求 | TechnicalRequirement 维护，按四维度匹配；brand/model/grade/spec 改为 FK 引用实体 | 开发中 |
| M06.F07 | 报告名称 | InspectionReportName CRUD + extFields 模板 + 关联标准/参数 | 开发中 |
| M06.F08 | 参数界面 | ParamInterface 维护 + 参数↔界面 link | 开发中 |
| M06.F09 | 报告名称扩展属性界面 | InspectionReportNameInterface 维护 + 报告名称↔界面 link（样品信息扩展属性，2026-11-10 接替 ext_fields） | 开发中 |

### M06.F04 检测标准

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F04.I05 | 项目↔报告名称 unlink | 接口 | 前端+后端 | DELETE /api/report-names/links/object：404 if 不存在 | 开发中 |
| M06.F04.I06 | 报告名称↔参数 unlink | 接口 | 前端+后端 | DELETE /api/report-names/links/parameter：404 if 不存在 | 开发中 |
| M06.F04.I07 | 报告名称↔标准 unlink | 接口 | 前端+后端 | DELETE /api/report-names/links/standard：404 if 不存在 | 开发中 |

### M06.F05 计算方法

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|------|---|---|
| M06.F05.I01 | 计算方法列表 | 接口 | 前端+后端 | GET /api/calculation-methods?inspectionObjectCode=&inspectionParameterCode=：平台级（无 tenant 过滤） | 开发中 |
| M06.F05.I02 | 计算方法详情 | 接口 | 前端+后端 | GET /api/calculation-methods/{inspectionObjectCode}/{inspectionParameterCode}：复合主键 | 开发中 |
| M06.F05.I03 | 创建计算方法 | 接口 | 前端+后端 | POST /api/calculation-methods：body CreateCalculationMethodRequest，algorithmType 默认 MANUAL | 开发中 |
| M06.F05.I04 | 更新计算方法 | 接口 | 前端+后端 | PUT /api/calculation-methods/{...}：PATCH 语义 | 开发中 |
| M06.F05.I05 | 删除计算方法 | 接口 | 前端+后端 | DELETE /api/calculation-methods/{...}：204 | 开发中 |

### M06.F06 技术要求

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F06.I01 | 技术要求列表 | 接口 | 前端+后端 | GET /api/technical-requirements?inspectionObjectCode=&inspectionParameterCode=&judgmentStandardCode=&verificationStatus=：tenant 收口 + 4 过滤 | 开发中 |
| M06.F06.I02 | 技术要求详情 | 接口 | 前端+后端 | GET /api/technical-requirements/{object}/{param}/{standard}：复合三键 | 开发中 |
| M06.F06.I03 | 创建技术要求 | 接口 | 前端+后端 | POST /api/technical-requirements：tenant 从 token claim 注入；默认值 numeric/≥/manual/draft | 开发中 |
| M06.F06.I04 | 更新技术要求 | 接口 | 前端+后端 | PUT /api/technical-requirements/{...}：PATCH 语义 | 开发中 |
| M06.F06.I05 | 删除技术要求 | 接口 | 前端+后端 | DELETE /api/technical-requirements/{...}：204 | 开发中 |

### M06.F07 报告名称

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F07.I01 | 报告名称列表 | 接口 | 前端+后端 | GET /api/report-names?page=&pageSize=&keyword=：`Page<InspectionReportName>`，按 code/name 模糊 | 开发中 |
| M06.F07.I02 | 报告名称详情 | 接口 | 前端+后端 | GET /api/report-names/{code}：返回 InspectionReportName（含 extFields 反序列化的 `List<ExtFieldDef>`） | 开发中 |
| M06.F07.I03 | 创建报告名称 | 接口 | 前端+后端 | POST /api/report-names：code/name 必填；extFields 默认 [] | 开发中 |
| M06.F07.I04 | 更新报告名称 | 接口 | 前端+后端 | PUT /api/report-names/{code}：PATCH 语义 | 开发中 |
| M06.F07.I05 | 删除报告名称 | 接口 | 前端+后端 | DELETE /api/report-names/{code}：204 if exists | 开发中 |
| M06.F07.I06 | 项目↔报告名称 link | 接口 | 前端+后端 | POST /api/report-names/links/object：建立 object→report-name 关联，remark 可选 | 开发中 |
| M06.F07.I07 | 报告名称↔标准 link | 接口 | 前端+后端 | POST /api/report-names/links/standard：建立 report-name→standard(role) 关联，role 必填 | 开发中 |
| M06.F07.I08 | 报告名称↔参数 link | 接口 | 前端+后端 | POST /api/report-names/links/parameter：建立 report-name→parameter 关联 | 开发中 |

### M06.F08 参数界面

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F08.I01 | 参数界面列表 | 接口 | 前端+后端 | GET /api/param-interfaces?page=&pageSize=&keyword=：`Page<ParamInterface>`，按 code/name 模糊 | 开发中 |
| M06.F08.I02 | 参数界面详情 | 接口 | 前端+后端 | GET /api/param-interfaces/{code}：返回 ParamInterface（含 config 反序列化的 Map<String,Object>） | 开发中 |
| M06.F08.I03 | 创建参数界面 | 接口 | 前端+后端 | POST /api/param-interfaces：code/componentPath 必填；config 默认 {} | 开发中 |
| M06.F08.I04 | 更新参数界面 | 接口 | 前端+后端 | PUT /api/param-interfaces/{code}：PATCH 语义 | 开发中 |
| M06.F08.I05 | 删除参数界面 | 接口 | 前端+后端 | DELETE /api/param-interfaces/{code}：204 if exists | 开发中 |
| M06.F08.I06 | 参数↔界面 link | 接口 | 前端+后端 | POST /api/param-interfaces/links：建立 parameter→interface 关联，reportNameCode/config 可选（config 走 jsonb） | 开发中 |

### M06.F09 报告名称扩展属性界面

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M06.F09.I01 | 界面列表 | 接口 | 前端+后端 | GET /api/report-name-interfaces?page=&pageSize=&keyword=：`Page<ReportNameInterface>`，按 code/name 模糊 | 开发中 |
| M06.F09.I02 | 界面详情 | 接口 | 前端+后端 | GET /api/report-name-interfaces/{code}：返回 ReportNameInterface（含 config 反序列化的 Map<String,Object>） | 开发中 |
| M06.F09.I03 | 创建界面 | 接口 | 前端+后端 | POST /api/report-name-interfaces：code 必填；config 默认 {}；version 默认 1 | 开发中 |
| M06.F09.I04 | 更新界面 | 接口 | 前端+后端 | PUT /api/report-name-interfaces/{code}：PATCH 语义 | 开发中 |
| M06.F09.I05 | 删除界面 | 接口 | 前端+后端 | DELETE /api/report-name-interfaces/{code}：204 if exists；级联删 report-name-interface-links | 开发中 |
| M06.F09.I06 | 报告名称↔界面 link | 接口 | 前端+后端 | POST /api/report-name-interfaces/links：建立 reportName→interface 关联（复合 PK 去重 400） | 开发中 |
| M06.F09.I07 | 报告名称↔界面 unlink | 接口 | 前端+后端 | DELETE /api/report-name-interfaces/links：幂等 204 | 开发中 |

（GET /api/report-name-interfaces/links → ADR-0034 §3 link GET list 自然豁免）

