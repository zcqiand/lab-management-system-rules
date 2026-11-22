# REQ-2026-043 标准规则服务五域实现（R2）

> 状态：进行中（R2 执行）
> 设计：suite 仓 `docs/superpowers/specs/2026-11-22-standard-rules-service-design.md`（2026-11-22 brainstorming 收口，builder check 已跑）
> 计划：suite 仓 `docs/superpowers/plans/2026-11-22-standard-rules-service-r2.md`（13 任务，Native inline）
> 人批记录：2026-11-22「两点处理」（push suite 父仓 + R2 开工，构成 shared 纯增 calc 段人批依据）；calc 段树变更提案人批在案

## 需求

`lab-management-system-rules`（X18=5214）成为 lab 家族标准规则域的唯一逻辑实现：
技术要求 / 计算方法 / 参数界面 / 样品界面（report-name-interfaces）/ 报告类别（report-names）
五域 + 四码表（M04.F06-F09 catalog）+ calc 段（公式求值与记录复现，shared 已批纯增、
落地后镜像登记）+ auth 最小面（login+me，CT 每 target login 硬依赖）。
R2 按 plan 逐域 TDD 实现，逐语义镜像 nextjs 参照实现。

## 验收

- rules 仓门禁 L0-L5 全绿；trace 覆盖五域 + 四码表 + calc + auth 挂 ID 用例
- CT 增 rules target 重定向（[nextjs, rules] 比对面）+ calc 新用例，live 全绿
- shared 纯增 calc 契约段人批落地（公式求值与记录复现两接口）
- GA 翻转（开发中→已上线）凭本节人工验收通过记录走 mirror 免批

## 树登记

五域 + 四码表 F/I 行镜像 shared BASE 登记，走 mirror 免批（`tree_change.py --apply`，
ADR-0042 三类之一「镜像登记」）；calc 段属已批 calc 面，随 shared 落地后镜像。
