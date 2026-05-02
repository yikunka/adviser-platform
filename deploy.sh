#!/usr/bin/env bash
# ============================================================================
# Adviser Platform — 生产部署脚本（本地执行，通过 SSH 操作远端）
#
# 用法概览
#   ./deploy.sh bootstrap   # 仅在「全新」Ubuntu/Debian 服务器上执行一次：系统依赖、Node、PM2、Nginx、可选 PostgreSQL
#   ./deploy.sh deploy      # 默认：本地构建 → 同步 standalone + 静态资源 + Prisma → 远端迁移 → PM2 重启
#   ./deploy.sh check       # 仅检查本地环境与仓库状态
#
# 必设环境变量（bootstrap / deploy 共用）
#   DEPLOY_HOST          例如 203.0.113.10 或 deploy.example.com
#   DEPLOY_USER          默认 root（建议使用具备 sudo 的专用账号并配置 SSH 公钥）
#   REMOTE_DIR           默认 /opt/adviser-app
#
#   bootstrap 支持的系统：Ubuntu/Debian（apt）、Alibaba Cloud Linux / RHEL / CentOS / Amazon Linux（dnf 或 yum）
#
# 可选
#   DEPLOY_SSH_KEY       SSH 私钥路径，例如 ~/.ssh/id_ed25519
#   DEPLOY_DOMAIN        对外域名，用于 Nginx server_name（bootstrap 写站点配置时）
#   CERTBOT_EMAIL        Let's Encrypt 邮箱；若与 DEPLOY_DOMAIN 同时设置，bootstrap 末尾尝试非交互式申请证书
#   BOOTSTRAP_WITH_POSTGRES=1   在服务器本机安装 PostgreSQL 并创建 adviser / adviser_db（密码见下）
#   POSTGRES_APP_PASSWORD      与上一项配合，数据库用户 adviser 的密码
#
# 远端生产环境变量：首次需在服务器 REMOTE_DIR 下放置 .env（可参考 .env.example），勿提交密钥到 Git。
#
# 安全提示：请勿在脚本中写入明文密码；使用 SSH 密钥与服务器上的 root 可读 .env。
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/adviser-app}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "${DEPLOY_SSH_KEY}")
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST:-}"

rsync_rsh() {
  local s="ssh"
  for x in "${SSH_OPTS[@]}"; do s+=" $(printf '%q' "$x")"; done
  printf '%s' "$s"
}

die() { echo "错误: $*" >&2; exit 1; }

require_deploy_host() {
  [[ -n "${DEPLOY_HOST:-}" ]] || die "请设置环境变量 DEPLOY_HOST"
}

ssh_remote() {
  require_deploy_host
  ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"
}

# 本地：构建所需
cmd_check() {
  command -v node >/dev/null 2>&1 || die "未找到 node，请先安装 Node.js 20+（推荐 22）"
  command -v npm >/dev/null 2>&1 || die "未找到 npm"
  local v
  v="$(node -v | tr -d 'v' | cut -d. -f1)"
  [[ "${v}" -ge 20 ]] || die "Node 主版本需 >= 20，当前: $(node -v)"

  [[ -f package-lock.json ]] || die "缺少 package-lock.json，请先 npm install 并提交锁文件"
  [[ -f prisma/schema.prisma ]] || die "未找到 prisma/schema.prisma"
  echo "✓ 本地检查通过"
}

cmd_build() {
  cmd_check
  echo "▶ 安装依赖 (npm ci)..."
  npm ci
  echo "▶ prisma generate..."
  npx prisma generate
  echo "▶ next build..."
  npm run build
  [[ -f .next/standalone/server.js ]] || die "未生成 .next/standalone/server.js，请确认 next.config 中 output: standalone"
  echo "✓ 构建完成"
}

# 同步产物 + 运行迁移 + PM2
cmd_deploy() {
  require_deploy_host
  cmd_build

  echo "▶ 同步文件到 ${REMOTE}:${REMOTE_DIR} ..."
  ssh_remote "mkdir -p '${REMOTE_DIR}/.next/static' '${REMOTE_DIR}/public' '${REMOTE_DIR}/prisma'"

  RSYNC_E="$(rsync_rsh)"
  rsync -az --delete -e "$RSYNC_E" .next/standalone/ "${REMOTE}:${REMOTE_DIR}/"
  rsync -az --delete -e "$RSYNC_E" .next/static/ "${REMOTE}:${REMOTE_DIR}/.next/static/"
  rsync -az -e "$RSYNC_E" public/ "${REMOTE}:${REMOTE_DIR}/public/"
  rsync -az -e "$RSYNC_E" prisma/ "${REMOTE}:${REMOTE_DIR}/prisma/"
  rsync -az -e "$RSYNC_E" prisma.config.ts "${REMOTE}:${REMOTE_DIR}/prisma.config.ts"

  echo "▶ 远端数据库迁移 (prisma migrate deploy)..."
  # 使用 bash source 加载 .env（与 .env.example 中带引号的值兼容）；APP_DIR 由本地 REMOTE_DIR 传入
  ssh_remote "bash -s" <<END_SSH
set -euo pipefail
APP_DIR='${REMOTE_DIR}'
cd "\$APP_DIR"
[[ -f .env ]] || { echo "远端缺少 \$APP_DIR/.env，请先根据 .env.example 创建并配置 DATABASE_URL 等"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
[[ -n "\${DATABASE_URL:-}" ]] || { echo ".env 中未设置 DATABASE_URL"; exit 1; }
if ! command -v prisma >/dev/null 2>&1; then
  echo "远端未安装 prisma CLI，请在服务器执行: npm install -g prisma"
  exit 1
fi
prisma migrate deploy
END_SSH

  echo "▶ 写入启动脚本（加载 .env 后 exec node）..."
  ssh_remote "bash -s" <<END_SSH
set -euo pipefail
APP_DIR='${REMOTE_DIR}'
cat > "\$APP_DIR/start-prod.sh" << 'EOS'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo "缺少 .env"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
export NODE_ENV=production
exec node server.js
EOS
chmod +x "\$APP_DIR/start-prod.sh"
END_SSH

  echo "▶ PM2 启动 / 重启..."
  ssh_remote "bash -s" <<END_SSH
set -euo pipefail
APP_DIR='${REMOTE_DIR}'
cd "\$APP_DIR"
if pm2 describe adviser >/dev/null 2>&1; then
  pm2 restart adviser --update-env
else
  pm2 start ./start-prod.sh --name adviser --cwd "\$APP_DIR" --time
  pm2 save
fi
END_SSH

  echo "✓ 部署完成。请确认 Nginx / HTTPS 已指向本机 Node（默认 3000）。"
}

# 在全新服务器上安装运行栈（需 root；支持 apt / dnf / yum）
cmd_bootstrap() {
  require_deploy_host

  local with_postgres="${BOOTSTRAP_WITH_POSTGRES:-0}"
  local pg_password="${POSTGRES_APP_PASSWORD:-}"

  if [[ "${with_postgres}" == "1" ]]; then
    [[ -n "${pg_password}" ]] || die "设置 BOOTSTRAP_WITH_POSTGRES=1 时必须设置 POSTGRES_APP_PASSWORD"
  fi

  echo "▶ 在 ${REMOTE} 上执行系统初始化（自动识别 apt / dnf / yum）..."

  REMOTE_DIR_ESC="${REMOTE_DIR}"
  DEPLOY_DOMAIN_ESC="${DEPLOY_DOMAIN:-}"
  CERTBOT_EMAIL_ESC="${CERTBOT_EMAIL:-}"
  WITH_PG="${with_postgres}"
  PG_PASS="${pg_password}"

  ssh_remote "bash -s" <<END_BOOTSTRAP
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REMOTE_DIR='${REMOTE_DIR_ESC}'
DEPLOY_DOMAIN='${DEPLOY_DOMAIN_ESC}'
CERTBOT_EMAIL='${CERTBOT_EMAIL_ESC}'
WITH_PG='${WITH_PG}'
PG_PASS='${PG_PASS}'

if command -v apt-get >/dev/null 2>&1; then
  FAMILY=deb
elif command -v dnf >/dev/null 2>&1; then
  FAMILY=rpm
  PM=(dnf -y)
elif command -v yum >/dev/null 2>&1; then
  FAMILY=rpm
  PM=(yum -y)
else
  echo "未找到 apt-get / dnf / yum，本脚本不支持当前发行版。"
  exit 1
fi

write_nginx_site() {
  local out="\$1"
  local names="\$2"
  cat > "\$out" <<NGX
upstream adviser_nextjs {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name \$names;

    client_max_body_size 50M;

    location /_next/static/ {
        proxy_pass http://adviser_nextjs;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /_next/image {
        proxy_pass http://adviser_nextjs;
    }

    location / {
        proxy_pass http://adviser_nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 60s;
    }
}
NGX
}

SERVER_NAMES="_"
if [[ -n "\$DEPLOY_DOMAIN" ]]; then
  SERVER_NAMES="\$DEPLOY_DOMAIN www.\$DEPLOY_DOMAIN"
fi

if [[ "\$FAMILY" == deb ]]; then
  echo "==> [Debian/Ubuntu] apt 更新与基础包..."
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git rsync nginx openssl ufw \
    build-essential python3

  echo "==> 防火墙 (ufw)..."
  ufw allow OpenSSH
  ufw allow 'Nginx HTTP'
  ufw allow 'Nginx HTTPS'
  ufw --force enable || true

  echo "==> Node.js 22.x (NodeSource deb)..."
  if command -v node >/dev/null 2>&1; then
    echo "已安装: \$(node -v)"
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi

  mkdir -p "\$REMOTE_DIR"
  chown -R www-data:www-data /var/www/html 2>/dev/null || true

  SITE_NAME="adviser"
  CONF_PATH="/etc/nginx/sites-available/\${SITE_NAME}"
  ENABLED="/etc/nginx/sites-enabled/\${SITE_NAME}"
  write_nginx_site "\$CONF_PATH" "\$SERVER_NAMES"
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  ln -sf "\$CONF_PATH" "\$ENABLED"

  if [[ "\$WITH_PG" == "1" ]]; then
    echo "==> 安装 PostgreSQL (apt)..."
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='adviser'" | grep -q 1 || \
      sudo -u postgres psql -c "CREATE USER adviser WITH PASSWORD '\$PG_PASS';"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='adviser_db'" | grep -q 1 || \
      sudo -u postgres psql -c "CREATE DATABASE adviser_db OWNER adviser;"
    echo "数据库已创建: DATABASE_URL=postgresql://adviser:***@127.0.0.1:5432/adviser_db"
  fi

  if [[ -n "\$DEPLOY_DOMAIN" && -n "\$CERTBOT_EMAIL" ]]; then
    echo "==> Certbot (Let's Encrypt)..."
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx -d "\$DEPLOY_DOMAIN" --non-interactive --agree-tos -m "\$CERTBOT_EMAIL" --redirect || \
      echo "Certbot 失败（请检查域名 DNS 是否指向本机 80 端口）"
  fi
else
  echo "==> [RHEL 系] 安装基础包 (\"\${PM[*]}\")..."
  "\${PM[@]}" install ca-certificates curl gnupg2 git rsync nginx openssl python3 gcc gcc-c++ make firewalld ||
    "\${PM[@]}" install ca-certificates curl gnupg2 git rsync nginx openssl python3 gcc gcc-c++ make

  echo "==> 防火墙 (firewalld)..."
  if systemctl list-unit-files 2>/dev/null | grep -q '^firewalld\.service'; then
    systemctl enable firewalld
    systemctl start firewalld || true
    firewall-cmd --permanent --add-service=ssh 2>/dev/null || firewall-cmd --permanent --add-service=ssh-client 2>/dev/null || true
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --permanent --add-service=https 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
  else
    echo "（未启用 firewalld，请自行放行 22/80/443）"
  fi

  echo "==> Node.js 22.x (NodeSource rpm)..."
  if command -v node >/dev/null 2>&1; then
    echo "已安装: \$(node -v)"
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    "\${PM[@]}" install nodejs
  fi

  mkdir -p "\$REMOTE_DIR"

  echo "==> Nginx 站点配置 (conf.d)..."
  write_nginx_site "/etc/nginx/conf.d/adviser.conf" "\$SERVER_NAMES"
  rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

  if [[ "\$WITH_PG" == "1" ]]; then
    echo "==> 安装 PostgreSQL (rpm)..."
    "\${PM[@]}" install postgresql-server postgresql-contrib || "\${PM[@]}" install postgresql15-server 2>/dev/null || "\${PM[@]}" install postgresql-server
    if command -v postgresql-setup >/dev/null 2>&1; then
      postgresql-setup --initdb 2>/dev/null || postgresql-setup initdb 2>/dev/null || true
    fi
    systemctl enable postgresql 2>/dev/null || systemctl enable postgresql-15 2>/dev/null || true
    systemctl start postgresql 2>/dev/null || systemctl start postgresql-15 2>/dev/null || true
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='adviser'" 2>/dev/null | grep -q 1 || \
      sudo -u postgres psql -c "CREATE USER adviser WITH PASSWORD '\$PG_PASS';" 2>/dev/null || true
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='adviser_db'" 2>/dev/null | grep -q 1 || \
      sudo -u postgres psql -c "CREATE DATABASE adviser_db OWNER adviser;" 2>/dev/null || true
    echo "数据库已创建（若命令失败请根据发行版已启用的 PostgreSQL 服务名手动执行 initdb）"
  fi

  if [[ -n "\$DEPLOY_DOMAIN" && -n "\$CERTBOT_EMAIL" ]]; then
    echo "==> Certbot (Let's Encrypt)..."
    "\${PM[@]}" install certbot python3-certbot-nginx 2>/dev/null || \
      ("\${PM[@]}" install epel-release 2>/dev/null; "\${PM[@]}" install certbot python3-certbot-nginx) || \
      echo "未能安装 certbot，请手动安装后运行 certbot --nginx"
    command -v certbot >/dev/null 2>&1 && \
      certbot --nginx -d "\$DEPLOY_DOMAIN" --non-interactive --agree-tos -m "\$CERTBOT_EMAIL" --redirect || \
      echo "Certbot 失败（请检查域名 DNS 与仓库插件）"
  fi
fi

echo "==> 全局 PM2 + Prisma CLI..."
npm install -g pm2 prisma

nginx -t
systemctl reload nginx 2>/dev/null || systemctl restart nginx
systemctl enable nginx

echo ""
echo "===== Bootstrap 完成 ====="
echo "1. 在 \$REMOTE_DIR 创建 .env（参考仓库 .env.example）"
echo "2. 在本机执行: DEPLOY_HOST=${DEPLOY_HOST} ./deploy.sh deploy"
END_BOOTSTRAP

  echo "✓ 远端系统依赖与 Nginx 已就绪"
}

usage() {
  sed -n '2,30p' "$0" | tail -n +2
}

main() {
  local sub="${1:-deploy}"
  case "$sub" in
    check)   cmd_check ;;
    build)   cmd_build ;;
    deploy)  cmd_deploy ;;
    bootstrap) cmd_bootstrap ;;
    -h|--help|help) usage ;;
    *) die "未知命令: $sub。使用: $0 check | build | deploy | bootstrap | help" ;;
  esac
}

main "$@"
