# =============================================================================
# lab-management-system-rules — 生产镜像（node-service 栈，X18=5214）
#
#   单段 node:22-alpine：tsx 直跑 TS（mold node-service 运行形态=dev 同款，
#   无编译产物），npm ci 装全量依赖（tsx 在 devDependencies，生产跑 TS
#   必需，不 prune）。
#
# 端口：容器内监听 SERVER_PORT=5214（host=container 单层映射，ADR-0018；
#       X18 槽）。SERVER_PORT 不在镜像内 ENV 兜底——fail-fast 键由 env-file
#       保证（suite 硬规则 §1：禁 env 默认值兜底）。
#
# 探针（deploy-chain-fingerprints 总账两条在案）：
#   - wget -q -O /dev/null 真拉 GET（--spider 发 HEAD 会 405 假红，ktor 首航指纹）
#   - 地址用 127.0.0.1 字面量（busybox wget localhost→::1 指纹，2026-10-06 在案）
# =============================================================================

FROM node:22-alpine
WORKDIR /app

# 缓存友好分层：先拷 lock 面（依赖下载层），npmmirror 走仓内 .npmrc
COPY .npmrc package.json package-lock.json ./
RUN npm ci

COPY src ./src

# node:22-alpine 自带 uid 1000 的 node 用户
USER node
ENV TZ=UTC

EXPOSE 5214

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:5214/healthz || exit 1

CMD ["./node_modules/.bin/tsx", "src/server.ts"]
