#!/bin/sh
# Usage: lab-management-system-rules.sh <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]
#
# 由 .github/workflows/ci.yml 的 deploy job 远程调用:
#   ssh deploy@vps -- cd /home/deploy/lab-management-system-rules
#                    && sh lab-management-system-rules.sh $DOCKER_USERNAME $DOCKER_PASSWORD $VERSION
#
# VERSION 默认是 latest。tag-based deploy 时显式传 tag 名（v0.x.y-YYYYMMDD）。
# CI 同时 push :latest + :<tag> 两份镜像,回滚只要手动指定旧 tag 再跑一次本脚本。
#
# 与姊妹仓 lab-management-system-go.sh 的差异:
#   - 运行时 node:22-alpine + tsx 直跑 TS（mold node-service 形态，无编译产物）
#   - env 契约 2 key = .env.example 全集（SERVER_PORT + DATABASE_URL）。
#     DATABASE_URL R1 未消费但自举键集合随 env 契约齐全（防「扩键不同批=
#     首航假红」指纹，harness-textrpg v2.0.1 先例）；由 PG_HOST/PG_PASSWORD
#     合成（远程 lab_prod，go 同款）。R2 起接 drizzle 时直接可用。
#   - R1 无 JWT/SSO 面——后续批次扩键时本脚本 reconcile 段与 CI envs 同批补
#
# 前置: deploy 用户需在 docker 组中(sudo usermod -aG docker deploy)。
#        rules.env 由本脚本首启自举（secret 类 key 必须由 CI secrets 转发）。

set -eu

USERNAME="${1:-}"
PASSWORD="${2:-}"
VERSION="${3:-latest}"
IMAGE="${USERNAME}/lab-management-system-rules:${VERSION}"
BASE="/home/deploy/lab-management-system-rules"
CONTAINER_NAME="lab-management-system-rules"

NGINX_DOMAIN="${NGINX_DOMAIN:-lab-rules.xiangru.uk}"
NGINX_CERT_BASENAME="${NGINX_CERT_BASENAME:-xiangru-uk}"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]" >&2
  exit 2
fi

# rules.env 自举: env 契约 = .env.example 全集 10 key（R2 批；L0.5 deploy parity 比对基线）。
# secret 类缺转发 = fail fast（suite 硬规则 §1 纪律；textrpg v2.0.1 五键先例）。
if [ -z "${PG_PASSWORD:-}" ]; then
  echo "ERROR: PG_PASSWORD secret required (CI envs 转发;DATABASE_URL 合成必需)" >&2
  exit 1
fi
if [ -z "${LAB_JWT_SECRET:-}" ]; then
  echo "ERROR: LAB_JWT_SECRET secret required (CI envs 转发;JWT 签发 ≥32 字节 fail-fast)" >&2
  exit 1
fi
if [ -z "${LAB_SAAS_SERVICE_PASSWORD:-}" ]; then
  echo "ERROR: LAB_SAAS_SERVICE_PASSWORD secret required (CI envs 转发;saas 代理 login 必需)" >&2
  exit 1
fi
if [ ! -f "$BASE/rules.env" ]; then
  echo "→ bootstrapping $BASE/rules.env from env secrets"
  umask 077
  {
    printf 'SERVER_PORT=5214\n'
    printf 'DATABASE_URL=postgresql://postgres:%s@%s:5432/lab_prod\n' "$PG_PASSWORD" "${PG_HOST:-100.79.128.25}"
    printf 'LAB_CORS_ALLOWED_ORIGINS=https://lab-nextjs.xiangru.uk\n'
    printf 'SAAS_IDP_URL=https://saas-nextjs.xiangru.uk\n'
    printf 'LAB_SAAS_SERVICE_USER=alice\n'
    printf 'LAB_SAAS_SERVICE_PASSWORD=%s\n' "$LAB_SAAS_SERVICE_PASSWORD"
    printf 'LAB_SAAS_SERVICE_CLIENT_ID=lab-management\n'
    printf 'LAB_SAAS_CLIENT_ID=lab-management\n'
    printf 'LAB_JWT_SECRET=%s\n' "$LAB_JWT_SECRET"
    printf 'LAB_JWT_ISSUER=lab-management-system\n'
    printf 'LAB_JWT_TTL_SECONDS=3600\n'
  } > "$BASE/rules.env"
  chown deploy:deploy "$BASE/rules.env" 2>/dev/null || true
  chmod 600 "$BASE/rules.env"
fi
if ! grep -q '^SERVER_PORT=..*' "$BASE/rules.env"; then
  echo "ERROR: $BASE/rules.env has no SERVER_PORT line" >&2
  exit 1
fi
if ! grep -q '^DATABASE_URL=..*' "$BASE/rules.env"; then
  echo "ERROR: $BASE/rules.env has no DATABASE_URL line (env 契约全集自举；存量老 env 请删除后由本脚本重新自举)" >&2
  exit 1
fi

# 存量 rules.env 补键/占位值 reconcile（go 同款：bootstrap 残留占位会让容器起来即坏）
append_if_missing() {
  key="$1"; val="$2"
  if ! grep -q "^${key}=" "$BASE/rules.env"; then
    echo "→ append ${key} to existing $BASE/rules.env"
    umask 077
    printf '%s=%s\n' "$key" "$val" >> "$BASE/rules.env"
  fi
}
append_if_missing SERVER_PORT '5214'
if ! grep -q '^DATABASE_URL=..*' "$BASE/rules.env"; then
  printf 'DATABASE_URL=postgresql://postgres:%s@%s:5432/lab_prod\n' "$PG_PASSWORD" "${PG_HOST:-100.79.128.25}" >> "$BASE/rules.env"
fi
append_if_missing LAB_CORS_ALLOWED_ORIGINS 'https://lab-nextjs.xiangru.uk'
append_if_missing SAAS_IDP_URL 'https://saas-nextjs.xiangru.uk'
append_if_missing LAB_SAAS_SERVICE_USER 'alice'
append_if_missing LAB_SAAS_SERVICE_PASSWORD "$LAB_SAAS_SERVICE_PASSWORD"
append_if_missing LAB_SAAS_SERVICE_CLIENT_ID 'lab-management'
append_if_missing LAB_SAAS_CLIENT_ID 'lab-management'
append_if_missing LAB_JWT_SECRET "$LAB_JWT_SECRET"
append_if_missing LAB_JWT_ISSUER 'lab-management-system'
append_if_missing LAB_JWT_TTL_SECONDS '3600'

# nginx vhost 重渲染(每次 deploy 都跑,ADR-0018:容器端口变了 vhost 必须跟)。
# 模板每次都从 master 拉最新 —— VPS 本地老模板会渲染出老端口全家族 502(2026-09-03 事故)。
# ?v=$(date +%s) cache-buster：CDN/raw 缓存防在案（flutter 先例）。
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_VHOST_FILE="${NGINX_SITES_AVAILABLE}/${NGINX_DOMAIN}"
NGINX_VHOST_LINK="${NGINX_SITES_ENABLED}/${NGINX_DOMAIN}"
NGINX_TEMPLATE="${BASE}/nginx-vps.conf.example"

echo "→ fetching nginx-vps.conf.example template (always fresh from master)"
curl -fsSL "https://raw.githubusercontent.com/zcqiand/lab-management-system-rules/refs/heads/master/deploy/nginx-vps.conf.example?v=$(date +%s)" -o "${NGINX_TEMPLATE}"

# 渲染到临时文件 —— sed 顺序:cert 归一化规则必须排在 <domain>/YOUR_DOMAIN 通配之前
# (先替换 <domain> 会把 cert 路径占位符一并吃掉,2026-09-03 事故根因)。
TMP_VHOST="$(mktemp -t vpstpl.XXXXXX)"
sed \
  -e "s|/etc/nginx/ssl/<domain>\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|/etc/nginx/ssl/your-cert\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|<domain>|${NGINX_DOMAIN}|g" \
  -e "s|saas\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  -e "s|lab\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  "${NGINX_TEMPLATE}" > "${TMP_VHOST}"

if [ -e "${NGINX_VHOST_FILE}" ] && diff -q "${TMP_VHOST}" "${NGINX_VHOST_FILE}" >/dev/null 2>&1; then
  echo "→ nginx vhost ${NGINX_VHOST_FILE} unchanged, skip"
  rm -f "${TMP_VHOST}"
else
  echo "→ rendering nginx vhost ${NGINX_VHOST_FILE} (domain=${NGINX_DOMAIN} cert=${NGINX_CERT_BASENAME})"
  if [ -w "${NGINX_SITES_AVAILABLE}" ]; then
    cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}"
  else
    sudo cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}" \
      || { echo "ERROR: sudo cp ${NGINX_VHOST_FILE} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  if [ -w "${NGINX_SITES_ENABLED}" ]; then
    ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}"
  else
    sudo ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}" \
      || { echo "ERROR: sudo ln ${NGINX_VHOST_LINK} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  rm -f "${TMP_VHOST}"
  echo "→ nginx -t"
  sudo nginx -t
  echo "→ systemctl reload nginx"
  sudo systemctl reload nginx
  echo "✓ nginx reloaded"
fi

echo "→ image: $IMAGE"
echo "→ docker login"
printf '%s' "$PASSWORD" | docker login -u "$USERNAME" --password-stdin

echo "→ docker pull"
docker pull "$IMAGE"

echo "→ docker stop & rm $CONTAINER_NAME"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "→ docker run"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:5214:5214" \
  --env-file "$BASE/rules.env" \
  "$IMAGE"

echo "→ docker image prune"
docker image prune -f

echo "→ docker ps"
docker ps --filter name="$CONTAINER_NAME"

# 健康检查: 直接 wget /healthz 探 200。容器死亡提前终止循环, 立刻报失败。
i=0
while [ $i -lt 120 ]; do
  if wget --tries=1 --timeout=3 -q "http://127.0.0.1:5214/healthz" -O /dev/null 2>/dev/null; then
    echo "→ /healthz 200 (host 127.0.0.1:5214) after ${i}s"
    break
  fi
  if ! docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null | grep -q true; then
    echo "→ container not running, logs:"
    docker logs --tail 30 "$CONTAINER_NAME"
    exit 1
  fi
  i=$((i+1))
  sleep 1
done

if [ $i -ge 120 ]; then
  echo "→ /healthz 仍未 200(120s 上限), logs:"
  docker logs --tail 30 "$CONTAINER_NAME"
  exit 1
fi

echo "→ deploy done at $(date -u)"
