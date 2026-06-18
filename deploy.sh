#!/usr/bin/env bash
# ============================================================================
# Adviser Platform — 生产部署（deploy：未设 DEPLOY_HOST 时在运行脚本的机器上发布；设了则用 SSH/rsync 到远端）
#
# 用法概览
#   ./deploy.sh bootstrap        # 在「控制机（笔记本）」运行：SSH 登录 DEPLOY_HOST 后在远端执行与本机 bootstrap-local 相同的初始化
#   ./deploy.sh bootstrap-local  # 在「全新服务器」上直接运行（root/sudo）；勿设 DEPLOY_HOST — 装好系统栈后再配 .env 与 deploy-local
#   ./deploy.sh deploy               # 未设 DEPLOY_HOST：与本机 ./deploy.sh deploy-local 相同（pull + 增量）；设 DEPLOY_HOST：本机构建后经 SSH/rsync 到远端（同样按 .adviser-deploy-rev 增量）
#   ./deploy.sh deploy-local         # 与「未设 HOST 的 deploy」一致；可按习惯选用
#   ./deploy.sh check            # 仅检查构建环境与仓库
#
# 必设环境变量（仅「经 SSH」的 bootstrap / deploy 需要）
#   deploy、bootstrap（经 SSH）：需设置 DEPLOY_HOST
#   DEPLOY_HOST          可选留空（本机发布）；远端部署时为 SSH 主机，例如 203.0.113.10
#   DEPLOY_USER          默认 root（建议专用账号 + SSH 公钥，避免反复输入密码）
#   REMOTE_DIR           默认 /opt/adviser-app（运行目录，需事先放好 .env）
#
#   deploy-local、bootstrap-local：勿填 DEPLOY_HOST；bootstrap-local 需在本机用 root/sudo 执行
#   deploy-local 可选 DEPLOY_TARGET_DIR（默认与 REMOTE_DIR 相同，常为 /opt/adviser-app）
#
# deploy-local（与未设 HOST 时的 deploy）：增量与 git（成功部署后在 $APP_DIR/.adviser-deploy-rev 写入当时 HEAD）：
#   默认 git pull（--ff-only），再按「上次记录..当前 HEAD」变更只跑需要的步骤（无新同步内容则跳过 build / rsync / PM2）。
#   DEPLOY_SKIP_GIT_PULL=1 — 跳过 pull，仍基于 .adviser-deploy-rev 与 HEAD 增量
#   DEPLOY_FORCE_FULL=1 — 全流程（依赖 install、prisma generate、next build、同步、migrate、PM2）；对 deploy（SSH）同样有效
#   DEPLOY_FF_ONLY_GIT=0 — 使用普通 git pull（默认 1 = --ff-only）
#   DEPLOY_DISCARD_LOCKFILE=0 — 不自动丢弃服务器上 package-lock.json 本地改动（默认 1 = 丢弃后再 pull）
#
# deploy（设 DEPLOY_HOST）：同样基于 .adviser-deploy-rev 增量
#   部署前从远端读取 $REMOTE_DIR/.adviser-deploy-rev，与本地 HEAD 比对，只构建 / rsync / migrate 变更涉及的部分。
#   首次（远端无记录）自动全量；部署成功后将 HEAD 写回远端。
#
#   bootstrap 支持的系统：Ubuntu/Debian（apt）、Alibaba Cloud Linux / RHEL / CentOS / Amazon Linux（dnf 或 yum）
#
# 可选
#   DEPLOY_SSH_KEY       SSH 私钥路径，例如 ~/.ssh/id_ed25519
#   DEPLOY_DOMAIN        对外域名，用于 Nginx server_name（bootstrap 写站点配置时）
#   CERTBOT_EMAIL        Let's Encrypt 邮箱；若与 DEPLOY_DOMAIN 同时设置，bootstrap 末尾尝试非交互式申请证书
#   BOOTSTRAP_WITH_POSTGRES=1   【需要本机 PG 时请必设】。未设为 1 时不会安装 PostgreSQL（仅 Node/Nginx/PM2）；设为 1 时先卸载系统旧 PG 再通过 PGDG 装 16（旧数据请先备份）
#   身份与密码（与本地 DATABASE_URL 对齐，三选一组合）:
#     • 推荐：BOOTSTRAP_DATABASE_URL="postgresql://用户:密码@主机:5432/库名"（主机可忽略，仅用于解析用户/库/密码）
#     • 或显式：POSTGRES_APP_USER、POSTGRES_APP_DB（默认 adviser / adviser_db）+ POSTGRES_APP_PASSWORD
#   若 URL 中无密码，则仍用 POSTGRES_APP_PASSWORD。URL 中的密码可含特殊字符。
#   BOOTSTRAP_PG_GROUP      可选；若设置则创建 NOLOGIN 组角色并 GRANT 给应用用户（含 schema / 默认权限）
#
# 运行时系统依赖（bootstrap / 每次 deploy 自动安装，见 scripts/ensure-system-packages.sh）:
#   poppler-utils — pdftoppm / pdftotext（NAR1、KYC、文档分析多页 PDF）
#   fonts-noto-cjk / google-noto-cjk-fonts — DDR 等含中文 PDF 生成
#
# 远端生产环境变量：首次需在服务器 REMOTE_DIR 下放置 .env（可参考 .env.example），勿提交密钥到 Git。
# prisma：全新 PostgreSQL 会跑 prisma/migrations（单一 init）；若库里曾半路失败可先备份后重置 public schema 再 migrate（见 init migration 头注释）。
#
# 安全提示：勿在脚本里写密码。笔记本向 VPS 发包时请设 DEPLOY_HOST；若在目标机直接发布，不设 DEPLOY_HOST 即可 ./deploy.sh deploy。
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

_prepare_build_marker() {
  local marker
  marker="$(mktemp "${TMPDIR:-/tmp}/adviser-next-build.XXXXXX")"
  touch "$marker"
  printf '%s\n' "$marker"
}

_cleanup_build_marker() {
  local marker="${1:-}"
  [[ -n "$marker" ]] && rm -f "$marker"
}

_assert_file_fresh_after_marker() {
  local file="$1" marker="$2"
  [[ -e "$file" ]] || die "构建不完整：缺少 $file"
  [[ "$file" -nt "$marker" ]] || die "构建不完整：$file 不是本次构建生成，疑似沿用了旧产物"
}

_assert_next_build_complete() {
  local marker="$1"
  local build_id standalone_build_id
  local required_files=(
    ".next/BUILD_ID"
    ".next/required-server-files.json"
    ".next/routes-manifest.json"
    ".next/build-manifest.json"
    ".next/standalone/server.js"
    ".next/standalone/.next/BUILD_ID"
  )

  for file in "${required_files[@]}"; do
    _assert_file_fresh_after_marker "$file" "$marker"
  done

  [[ -d .next/static ]] || die "构建不完整：缺少 .next/static"
  [[ .next/static -nt "$marker" ]] || die "构建不完整：.next/static 不是本次构建生成，疑似沿用了旧产物"

  build_id="$(tr -d '[:space:]' < .next/BUILD_ID)"
  standalone_build_id="$(tr -d '[:space:]' < .next/standalone/.next/BUILD_ID)"
  [[ -n "$build_id" ]] || die "构建不完整：.next/BUILD_ID 为空"
  [[ "$build_id" == "$standalone_build_id" ]] || die "构建不完整：standalone BUILD_ID 与主产物不一致"
}

_read_build_id_from_dir() {
  local dir="$1"
  local path="${dir%/}/.next/BUILD_ID"
  [[ -f "$path" ]] || die "缺少 $path"
  tr -d '[:space:]' < "$path"
}

_assert_local_deploy_matches_build() {
  local app_dir="$1"
  local source_build_id target_build_id
  source_build_id="$(_read_build_id_from_dir ".")"
  target_build_id="$(_read_build_id_from_dir "$app_dir")"
  [[ "$source_build_id" == "$target_build_id" ]] || die "发布目录 BUILD_ID 不匹配：源码=.next/$source_build_id，目标=$app_dir/.next/$target_build_id"
}

_assert_remote_deploy_matches_build() {
  local remote_dir="$1"
  local source_build_id target_build_id
  source_build_id="$(_read_build_id_from_dir ".")"
  target_build_id="$(ssh_remote "tr -d '[:space:]' < '${remote_dir}/.next/BUILD_ID'")"
  [[ -n "$target_build_id" ]] || die "远端缺少 ${remote_dir}/.next/BUILD_ID"
  [[ "$source_build_id" == "$target_build_id" ]] || die "远端 BUILD_ID 不匹配：源码=.next/$source_build_id，远端=$remote_dir/.next/$target_build_id"
}

_configure_build_memory() {
  # Keep Next/TypeScript from being killed by the system OOM killer during production builds.
  export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--max-old-space-size=${DEPLOY_NODE_MEM_MB:-1536}"
}

require_deploy_host() {
  [[ -n "${DEPLOY_HOST:-}" ]] || die "请设置环境变量 DEPLOY_HOST"
}

ssh_remote() {
  require_deploy_host
  ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"
}

_bootstrap_pg_ident_ok() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

# 解析 URL 时需在本机已有 python3（bootstrap / bootstrap-local 的机器）
_bootstrap_resolve_pg_credentials() {
  PG_USER_ESC="${POSTGRES_APP_USER:-adviser}"
  PG_DB_ESC="${POSTGRES_APP_DB:-adviser_db}"

  local url="${BOOTSTRAP_DATABASE_URL:-}"
  PG_PASS_MERGED="${POSTGRES_APP_PASSWORD:-}"

  if [[ -n "${url}" ]]; then
    command -v python3 >/dev/null 2>&1 || die "解析 BOOTSTRAP_DATABASE_URL 需要已安装 python3（macOS/Python.org 均有）"
    eval "$(
      BOOTSTRAP_DATABASE_URL="${url}" \
        DEFAULT_PG_USER="${PG_USER_ESC}" \
        DEFAULT_PG_DB="${PG_DB_ESC}" \
        python3 <<'BOOTSTRAP_URL_PY'
import os, re, shlex, urllib.parse, sys

url = os.environ.get("BOOTSTRAP_DATABASE_URL", "").strip()
if not url:
    sys.exit("BOOTSTRAP_DATABASE_URL 为空")
if not url.startswith(("postgres://", "postgresql://")):
    sys.exit("DATABASE_URL 须以 postgres:// 或 postgresql:// 开头")
u_s = urllib.parse.urlsplit(url)
user = urllib.parse.unquote(u_s.username or "")
password = urllib.parse.unquote(u_s.password or "")
db = (u_s.path or "/").lstrip("/").split("?")[0].split("/")[0]
dup = os.environ.get("DEFAULT_PG_USER") or "adviser"
dd = os.environ.get("DEFAULT_PG_DB") or "adviser_db"
user = user or dup
db = db or dd
ident_re = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
for label, val in (("用户名", user), ("数据库名", db)):
    if not ident_re.match(val):
        sys.exit(f"{label} 非法（仅允许 PostgreSQL 非引号标识符）: {val!r}")

print(f"export BOOTSTRAP_PARSE_USER={shlex.quote(user)}")
print(f"export BOOTSTRAP_PARSE_DB={shlex.quote(db)}")
print(f"export BOOTSTRAP_PARSE_PW_FROM_URL={shlex.quote(password)}")
BOOTSTRAP_URL_PY
    )"
    PG_USER_ESC="${BOOTSTRAP_PARSE_USER}"
    PG_DB_ESC="${BOOTSTRAP_PARSE_DB}"
    if [[ -n "${BOOTSTRAP_PARSE_PW_FROM_URL}" ]]; then
      PG_PASS_MERGED="${BOOTSTRAP_PARSE_PW_FROM_URL}"
    fi
  fi

  _bootstrap_pg_ident_ok "$PG_USER_ESC" || die "非法 POSTGRES_APP_USER / 用户名: $PG_USER_ESC"
  _bootstrap_pg_ident_ok "$PG_DB_ESC" || die "非法 POSTGRES_APP_DB / 数据库名: $PG_DB_ESC"

  BOOTSTRAP_PG_GROUP_ESC="${BOOTSTRAP_PG_GROUP:-}"
  if [[ -n "${BOOTSTRAP_PG_GROUP_ESC}" ]]; then
    _bootstrap_pg_ident_ok "$BOOTSTRAP_PG_GROUP_ESC" || die "非法 BOOTSTRAP_PG_GROUP: $BOOTSTRAP_PG_GROUP_ESC"
  fi

  [[ -n "${PG_PASS_MERGED}" ]] || die "PostgreSQL 应用密码不能为空：在 BOOTSTRAP_DATABASE_URL 中写密码，或设置 POSTGRES_APP_PASSWORD"

  PG_PASS="${PG_PASS_MERGED}"
  PG_PASS_B64_ESC="$(printf '%s' "${PG_PASS}" | base64 | tr -d '\n')"
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
  local build_marker
  cmd_check
  echo "▶ 安装依赖..."
  npm install --no-audit --no-fund
  echo "▶ prisma generate..."
  npx prisma generate
  echo "▶ next build..."
  build_marker="$(_prepare_build_marker)"
  # 限制 Node 堆内存，防止构建时被 OOM Killer 杀掉；可用 DEPLOY_NODE_MEM_MB 覆盖（默认 1536 MB）
  _configure_build_memory
  npm run build
  _assert_next_build_complete "$build_marker"
  _cleanup_build_marker "$build_marker"
  if [[ -n "${OSS_BUCKET:-}" ]]; then
    echo "▶ 同步静态资源到 OSS..."
    node scripts/sync-oss-static.mjs
    echo "✓ OSS 静态资源同步完成"
  else
    echo "ℹ OSS_BUCKET 未设置，跳过 OSS 静态资源同步"
  fi
  echo "✓ 构建完成"
}

_ensure_runtime_system_packages() {
  local script="$SCRIPT_DIR/scripts/ensure-system-packages.sh"
  [[ -f "$script" ]] || {
    echo "⚠ 未找到 $script，跳过系统依赖安装"
    return 0
  }
  chmod +x "$script" 2>/dev/null || true
  echo "▶ 确认运行时系统依赖（poppler-utils、CJK 字体）…"
  if [[ "$(id -u)" -eq 0 ]]; then
    bash "$script"
  elif command -v sudo >/dev/null 2>&1; then
    sudo bash "$script"
  else
    echo "ℹ 跳过系统包安装（当前用户无 root/sudo）。新服务器请: sudo ./deploy.sh bootstrap-local"
  fi
}

_ensure_runtime_system_packages_remote() {
  local remote_dir="$1"
  ssh_remote "bash -s" <<END_SSH
set -euo pipefail
SCRIPT='${remote_dir}/scripts/ensure-system-packages.sh'
if [[ ! -f "\$SCRIPT" ]]; then
  echo 'ℹ 远端尚无 ensure-system-packages.sh，跳过（请先 rsync scripts/）'
  exit 0
fi
chmod +x "\$SCRIPT" 2>/dev/null || true
if [[ \$(id -u) -eq 0 ]]; then
  bash "\$SCRIPT"
elif command -v sudo >/dev/null 2>&1; then
  sudo bash "\$SCRIPT"
else
  echo 'ℹ 跳过系统包安装（远端无 root/sudo）'
fi
END_SSH
}

# 同步产物 + 运行迁移 + PM2（远端需 DEPLOY_HOST；未设 DEPLOY_HOST 时走 deploy-local）
cmd_deploy() {
  if [[ -z "${DEPLOY_HOST:-}" ]]; then
    echo "▶ DEPLOY_HOST 未设置 → 在当前机器发布（等同 deploy-local，含 git pull / 增量）"
    cmd_deploy_local
    return 0
  fi

  require_deploy_host

  # ── 增量判断：读取远端上次部署版本，与本地 HEAD 比对 ──────────────────────
  local HEAD_NOW REV_FROM _df_commit DID_ANY=0
  HEAD_NOW="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || true)"
  NEED_DEPS=0 NEED_BUILD=0 NEED_PRISMA_GEN=0 NEED_MIGRATE=0 NEED_RSYNC_PUBLIC=0
  _DL_N_ALL=0 _DL_N_REL=0

  if [[ -z "$HEAD_NOW" ]] || [[ "${DEPLOY_FORCE_FULL:-}" == "1" ]]; then
    echo "▶ 全量部署$([ "${DEPLOY_FORCE_FULL:-}" == "1" ] && echo "（DEPLOY_FORCE_FULL=1）" || echo "（非 git 目录）")"
    NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
  else
    REV_FROM_RAW="$(ssh_remote "cat '${REMOTE_DIR}/.adviser-deploy-rev' 2>/dev/null || true" 2>/dev/null | tr -d ' \t\r\n' || true)"
    # Resolve to a full commit SHA so a short/partial hash compares correctly below.
    REV_FROM="$(git -C "$SCRIPT_DIR" rev-parse --verify -q "${REV_FROM_RAW}^{commit}" 2>/dev/null || true)"

    if [[ -z "$REV_FROM_RAW" ]]; then
      echo "▶ 远端无部署记录（首次），全量"
      NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
    else
      if [[ -z "$REV_FROM" ]]; then
        echo "▶ 远端 .adviser-deploy-rev (${REV_FROM_RAW:0:7}…) 在本地不可见，全量"
        NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
      elif ! git -C "$SCRIPT_DIR" merge-base --is-ancestor "$REV_FROM" "$HEAD_NOW" 2>/dev/null; then
        echo "▶ 部署记录与当前历史不一致（rebase/amend），全量"
        NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
      elif [[ "$REV_FROM" == "$HEAD_NOW" ]]; then
        echo "✓ 远端已与当前提交一致（rev=${REV_FROM_RAW:0:12} = HEAD ${HEAD_NOW:0:12}…），无需部署。"
        if [[ "$REV_FROM_RAW" != "$HEAD_NOW" ]]; then
          ssh_remote "printf '%s\n' '${HEAD_NOW}' > '${REMOTE_DIR}/.adviser-deploy-rev'"
          echo "▶ 已将远端 .adviser-deploy-rev 规范化为完整 SHA"
        fi
        return 0
      else
        echo "▶ 增量比对：rev=${REV_FROM:0:12}（记录值 ${REV_FROM_RAW:0:12}）→ HEAD=${HEAD_NOW:0:12}"
        git -C "$SCRIPT_DIR" diff --name-only "${REV_FROM}..${HEAD_NOW}" | _deploy_local_classify_diff_lines

        if [[ "$_DL_N_ALL" -gt 0 ]] && [[ "$_DL_N_REL" -eq 0 ]]; then
          echo "✓ 有新提交但仅文档等非运行路径，跳过构建。（.adviser-deploy-rev 保持不变，下次重新核对）"
          return 0
        fi

        if [[ "$NEED_DEPS$NEED_BUILD$NEED_PRISMA_GEN$NEED_MIGRATE$NEED_RSYNC_PUBLIC" == "00000" ]]; then
          echo "✓ 无待发布变更。（.adviser-deploy-rev 保持不变，下次重新核对）"
          return 0
        fi

        echo "▶ 增量 (${REV_FROM:0:7}…→${HEAD_NOW:0:7}…) deps=$NEED_DEPS build=$NEED_BUILD prisma_gen=$NEED_PRISMA_GEN migrate=$NEED_MIGRATE public=$NEED_RSYNC_PUBLIC"
      fi
    fi
  fi

  # ── 按需本地构建 ───────────────────────────────────────────────────────────
  if [[ "$NEED_BUILD" == 1 ]]; then
    cmd_build
    DID_ANY=1
  elif [[ "$NEED_PRISMA_GEN" == 1 ]] || [[ "$NEED_DEPS" == 1 ]]; then
    cmd_check
    if [[ "$NEED_DEPS" == 1 ]]; then
      echo "▶ 安装依赖..."
      npm install --no-audit --no-fund
    fi
    if [[ "$NEED_PRISMA_GEN" == 1 ]]; then
      echo "▶ prisma generate..."
      npx prisma generate
    fi
    DID_ANY=1
  fi

  # ── 按需同步到远端 ─────────────────────────────────────────────────────────
  ssh_remote "mkdir -p '${REMOTE_DIR}/.next/static' '${REMOTE_DIR}/public' '${REMOTE_DIR}/prisma'"
  RSYNC_E="$(rsync_rsh)"

  if [[ "$NEED_BUILD" == 1 ]]; then
    echo "▶ 同步构建产物到 ${REMOTE}:${REMOTE_DIR} ..."
    rsync -az --delete -e "$RSYNC_E" .next/standalone/ "${REMOTE}:${REMOTE_DIR}/"
    rsync -az --delete -e "$RSYNC_E" .next/static/ "${REMOTE}:${REMOTE_DIR}/.next/static/"
    rsync -az --delete -e "$RSYNC_E" public/ "${REMOTE}:${REMOTE_DIR}/public/"
    rsync -az -e "$RSYNC_E" scripts/ "${REMOTE}:${REMOTE_DIR}/scripts/"
    rsync -az -e "$RSYNC_E" prisma/ "${REMOTE}:${REMOTE_DIR}/prisma/"
    rsync -az -e "$RSYNC_E" prisma.config.mjs "${REMOTE}:${REMOTE_DIR}/prisma.config.mjs"
    ssh_remote "rm -f '${REMOTE_DIR}/prisma.config.ts'"
    _assert_remote_deploy_matches_build "${REMOTE_DIR}"
    DID_ANY=1
  else
    if [[ "$NEED_RSYNC_PUBLIC" == 1 ]]; then
      echo "▶ 同步 public/ ..."
      rsync -az --delete -e "$RSYNC_E" public/ "${REMOTE}:${REMOTE_DIR}/public/"
      DID_ANY=1
    fi
    if [[ "$NEED_MIGRATE" == 1 ]]; then
      echo "▶ 同步 prisma/ ..."
      rsync -az -e "$RSYNC_E" prisma/ "${REMOTE}:${REMOTE_DIR}/prisma/"
      rsync -az -e "$RSYNC_E" prisma.config.mjs "${REMOTE}:${REMOTE_DIR}/prisma.config.mjs"
      ssh_remote "rm -f '${REMOTE_DIR}/prisma.config.ts'"
      DID_ANY=1
    fi
    if [[ "$NEED_DEPS" == 1 ]]; then
      echo "▶ 同步 scripts/ ..."
      rsync -az -e "$RSYNC_E" scripts/ "${REMOTE}:${REMOTE_DIR}/scripts/"
      DID_ANY=1
    fi
  fi

  _ensure_runtime_system_packages_remote "${REMOTE_DIR}"

  # ── 按需数据库迁移 ─────────────────────────────────────────────────────────
  if [[ "$NEED_MIGRATE" == 1 ]] || [[ "$NEED_BUILD" == 1 ]]; then
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
# Clear any migrations stuck in failed state (P3009) before deploying
psql "\${DATABASE_URL}" -q -c "
  UPDATE _prisma_migrations
  SET rolled_back_at = NOW()
  WHERE finished_at IS NULL
    AND rolled_back_at IS NULL
    AND started_at IS NOT NULL;
" 2>/dev/null && echo "✓ 已清除滞留的失败迁移记录（如有）" || true
prisma migrate deploy
END_SSH
    DID_ANY=1
  fi

  # ── 按需重写 start-prod.sh + PM2 重启 ─────────────────────────────────────
  if [[ "$NEED_BUILD" == 1 ]] || [[ "$NEED_MIGRATE" == 1 ]] || [[ "$NEED_DEPS" == 1 ]]; then
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
# Next standalone 用 HOSTNAME 作为 listen 地址；云主机常有不可解析的 ECS 实例名 → getaddrinfo ENOTFOUND
export HOSTNAME="0.0.0.0"
# 每次进程启动执行迁移，避免「代码已部署但 DB 未 migrate」（与上方 ssh migrate 重复但幂等）
if [[ "${SKIP_PRISMA_MIGRATE:-}" == "1" ]]; then
  echo "SKIP_PRISMA_MIGRATE=1 — 跳过 prisma migrate deploy"
else
  command -v prisma >/dev/null 2>&1 || { echo "错误：未找到 prisma CLI，无法执行 migrate deploy（见 DEPLOY.md）"; exit 1; }
  echo "▶ start-prod.sh: prisma migrate deploy…"
  prisma migrate deploy
fi
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
    DID_ANY=1
  elif [[ "$DID_ANY" == 1 ]] && [[ "$NEED_RSYNC_PUBLIC" == 1 ]]; then
    echo "ℹ️ 仅 public 已同步；按需执行: ssh ${REMOTE} pm2 restart adviser --update-env"
  fi

  # ── 写入远端版本记录 ───────────────────────────────────────────────────────
  if [[ -n "$HEAD_NOW" ]]; then
    ssh_remote "printf '%s\n' '${HEAD_NOW}' > '${REMOTE_DIR}/.adviser-deploy-rev'"
    echo "▶ 已写入远端 .adviser-deploy-rev (${HEAD_NOW:0:12}…)"
  fi

  echo "✓ 部署完成。请确认 Nginx / HTTPS 已指向本机 Node（默认 3000）。"
}

# ── deploy-local：git pull + 按变更增量执行（$APP_DIR/.adviser-deploy-rev 记录上次成功部署的 commit）──
_deploy_revision_file() {
  printf '%s/.adviser-deploy-rev' "${1%/}"
}

_deploy_discard_lockfile_drift() {
  if [[ "${DEPLOY_DISCARD_LOCKFILE:-1}" != "1" ]]; then
    return 0
  fi
  if ! git -C "$SCRIPT_DIR" diff --quiet -- package-lock.json 2>/dev/null; then
    echo "▶ 丢弃服务器上 package-lock.json 的本地改动（多为误执行 npm install 导致）…"
    git -C "$SCRIPT_DIR" checkout -- package-lock.json 2>/dev/null \
      || git -C "$SCRIPT_DIR" restore package-lock.json 2>/dev/null \
      || true
  fi
}

_deploy_local_git_pull_maybe() {
  if [[ "${DEPLOY_SKIP_GIT_PULL:-}" == "1" ]]; then
    echo "▶ 跳过 git pull（DEPLOY_SKIP_GIT_PULL=1）"
    return 0
  fi
  if ! git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "⚠️ 当前目录不是 git 工作树，跳过 git pull"
    return 0
  fi
  _deploy_discard_lockfile_drift
  echo "▶ git pull…"
  local before
  before="$(git -C "$SCRIPT_DIR" rev-parse HEAD)"
  if [[ "${DEPLOY_FF_ONLY_GIT:-1}" == "1" ]]; then
    git -C "$SCRIPT_DIR" pull --ff-only || die "git pull --ff-only 失败（本地有分叉？试 DEPLOY_FF_ONLY_GIT=0 或 DEPLOY_FORCE_FULL=1）"
  else
    git -C "$SCRIPT_DIR" pull || die "git pull 失败"
  fi
  local after
  after="$(git -C "$SCRIPT_DIR" rev-parse HEAD)"
  if [[ "$before" != "$after" ]]; then
    echo "✓ pull 后 HEAD: ${before:0:7} → ${after:0:7}"
  else
    echo "✓ 已是最新，HEAD 未变（${after:0:7}）"
  fi
}

_deploy_local_path_ignored_for_incremental() {
  # Anything under src/ is part of the build output (including runtime assets that
  # happen to be markdown, e.g. src/lib/feedback/system-knowledge.md) — never treat
  # it as docs-only, otherwise a change to it would be skipped and never deployed.
  case "$1" in
    src/*)
      return 1
      ;;
  esac
  case "$1" in
    README*|CHANGELOG*|CONTRIBUTING*|LICENSE*|CODEOWNERS|.git*|*.md|*.MD)
      return 0
      ;;
    docs/*|PRD*|PRD_DOC/*|.github/*|.vscode/*|.cursor/*|.claude/*|AGENTS*|.agent*|Makefile|Makefile.*|.env.example|flake.nix)
      return 0
      ;;
  esac
  return 1
}

# 从 stdin 读取 git diff --name-only 行，设置 NEED_*（调用方作用域，勿用 local）
_deploy_local_classify_diff_lines() {
  NEED_DEPS=0
  NEED_BUILD=0
  NEED_PRISMA_GEN=0
  NEED_MIGRATE=0
  NEED_RSYNC_PUBLIC=0
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    _DL_N_ALL=$((_DL_N_ALL + 1))
    if _deploy_local_path_ignored_for_incremental "$f"; then
      continue
    fi
    _DL_N_REL=$((_DL_N_REL + 1))

    if [[ "$f" =~ ^prisma/migrations/ ]]; then
      NEED_MIGRATE=1
      continue
    fi

    case "$f" in
      package.json|package-lock.json|npm-shrinkwrap.json)
        NEED_DEPS=1
        NEED_BUILD=1
        ;;
      prisma/schema.prisma|prisma.config.mjs|prisma.config.ts)
        NEED_PRISMA_GEN=1
        NEED_BUILD=1
        ;;
      prisma/*)
        NEED_PRISMA_GEN=1
        NEED_BUILD=1
        ;;
      public/*)
        NEED_RSYNC_PUBLIC=1
        ;;
      deploy.sh|*.wasm)
        NEED_BUILD=1
        ;;
      src/*|next.config.ts|next.config.js|next.config.mjs|postcss.config.*|tailwind.config.*|eslint.config.*|instrumentation.ts|src/proxy.ts|tsconfig*.json|components.json|.env.production)
        NEED_BUILD=1
        ;;
      *)
        NEED_BUILD=1
        ;;
    esac
  done
}

_deploy_local_maybe_npm_prisma_next() {
  local build_marker=""
  local need_deps="$1" need_gen="$2" need_build="$3"
  if [[ "$need_deps" == 1 ]] || [[ "$need_gen" == 1 ]] || [[ "$need_build" == 1 ]]; then
    cmd_check
  fi

  if [[ "$need_deps" == 1 ]]; then
    echo "▶ npm 安装依赖…"
    npm install --no-audit --no-fund
  fi

  if [[ "$need_gen" == 1 ]] || [[ "$need_build" == 1 ]]; then
    echo "▶ prisma generate…"
    npx prisma generate
  fi

  if [[ "$need_build" == 1 ]]; then
    echo "▶ next build…"
    build_marker="$(_prepare_build_marker)"
    _configure_build_memory
    npm run build
    _assert_next_build_complete "$build_marker"
    _cleanup_build_marker "$build_marker"
    if [[ -n "${OSS_BUCKET:-}" ]]; then
      echo "▶ 同步静态资源到 OSS..."
      node scripts/sync-oss-static.mjs
      echo "✓ OSS 静态资源同步完成"
    fi
    echo "✓ 构建完成"
  fi
}

_deploy_local_sync_to_app_dir() {
  local APP_DIR="$1"
  local need_build="$2" need_pub="$3" need_mig="$4"
  echo "▶ 发布到本机目录: $APP_DIR（无 SSH）…"
  mkdir -p "$APP_DIR/.next/static" "$APP_DIR/public" "$APP_DIR/prisma"

  if [[ "$need_build" == 1 ]]; then
    rsync -a --delete .next/standalone/ "$APP_DIR/"
    rsync -a --delete .next/static/ "$APP_DIR/.next/static/"
    rsync -a --delete public/ "$APP_DIR/public/"
    rsync -a scripts/ "$APP_DIR/scripts/"
    rsync -a prisma/ "$APP_DIR/prisma/"
    rsync -a prisma.config.mjs "$APP_DIR/prisma.config.mjs"
    rm -f "$APP_DIR/prisma.config.ts"
    _assert_local_deploy_matches_build "$APP_DIR"
    return 0
  fi

  if [[ "$need_pub" == 1 ]]; then
    rsync -a --delete public/ "$APP_DIR/public/"
  fi
  if [[ "$need_mig" == 1 ]]; then
    rsync -a prisma/ "$APP_DIR/prisma/"
    rsync -a prisma.config.mjs "$APP_DIR/prisma.config.mjs"
    rm -f "$APP_DIR/prisma.config.ts"
  fi
}

_resolve_failed_migrations() {
  # Clear any migrations that are stuck in a "failed" state (P3009).
  # This happens when a previous deploy crashed mid-migration.
  # Safe to run even when there are no failures (updates 0 rows).
  local db_url="${DATABASE_URL:-}"
  if [[ -n "$db_url" ]]; then
    psql "$db_url" -q -c "
      UPDATE _prisma_migrations
      SET rolled_back_at = NOW()
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL;
    " 2>/dev/null && echo "✓ 已清除滞留的失败迁移记录（如有）" || true
  fi
}

_deploy_local_migrate() {
  local APP_DIR="$1"
  echo "▶ 数据库迁移 (prisma migrate deploy)…"
  [[ -f "$APP_DIR/.env" ]] || die "缺少 $APP_DIR/.env（请先按 .env.example 创建）"

  if [[ -x "$SCRIPT_DIR/node_modules/.bin/prisma" ]] || [[ -f "$SCRIPT_DIR/node_modules/prisma/package.json" ]]; then
    pushd "$SCRIPT_DIR" >/dev/null
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
    set +a
    [[ -n "${DATABASE_URL:-}" ]] || die ".env 中未设置 DATABASE_URL（检查 $APP_DIR/.env）"
    _resolve_failed_migrations
    npx prisma migrate deploy
    popd >/dev/null
    return 0
  fi

  pushd "$APP_DIR" >/dev/null
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  [[ -n "${DATABASE_URL:-}" ]] || die ".env 中未设置 DATABASE_URL"
  command -v prisma >/dev/null 2>&1 || die "未找到 prisma：请在仓库内 npm ci，或 npm install -g prisma"
  _resolve_failed_migrations
  prisma migrate deploy
  popd >/dev/null
}

_deploy_local_install_start_pm2() {
  local APP_DIR="$1"
  echo "▶ 写入 start-prod.sh…"
  cat > "$APP_DIR/start-prod.sh" << 'EOS'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo "缺少 .env"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
export NODE_ENV=production
export HOSTNAME="0.0.0.0"
if [[ "${SKIP_PRISMA_MIGRATE:-}" == "1" ]]; then
  echo "SKIP_PRISMA_MIGRATE=1 — 跳过 prisma migrate deploy"
else
  command -v prisma >/dev/null 2>&1 || { echo "错误：未找到 prisma CLI，无法执行 migrate deploy"; exit 1; }
  echo "▶ start-prod.sh: prisma migrate deploy…"
  prisma migrate deploy
fi
exec node server.js
EOS
  chmod +x "$APP_DIR/start-prod.sh"

  echo "▶ PM2 启动 / 重启…"
  pushd "$APP_DIR" >/dev/null
  if pm2 describe adviser >/dev/null 2>&1; then
    pm2 restart adviser --update-env
  else
    pm2 start ./start-prod.sh --name adviser --cwd "$APP_DIR" --time
    pm2 save
  fi
  popd >/dev/null
}

# 在生产服务器「本机」：默认 git pull，再按 $APP_DIR/.adviser-deploy-rev ↔ HEAD 的差异增量构建/同步。
cmd_deploy_local() {
  local APP_DIR="${DEPLOY_TARGET_DIR:-$REMOTE_DIR}"
  local REV_FILE HEAD_NOW DIFF_FROM _df_commit
  local DID_ANY=0
  NEED_DEPS=0
  NEED_BUILD=0
  NEED_PRISMA_GEN=0
  NEED_MIGRATE=0
  NEED_RSYNC_PUBLIC=0
  _DL_N_ALL=0
  _DL_N_REL=0

  [[ -n "$APP_DIR" ]] || die "APP_DIR 为空，设置 REMOTE_DIR 或 DEPLOY_TARGET_DIR"

  if ! git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "⚠️ 无法做 git 增量，将执行全量部署（请设 DEPLOY_FORCE_FULL=1 显式可控）"
    DEPLOY_FORCE_FULL=1
  fi

  _deploy_local_git_pull_maybe

  REV_FILE="$(_deploy_revision_file "$APP_DIR")"
  HEAD_NOW="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || true)"

  if [[ "${DEPLOY_FORCE_FULL:-}" == "1" ]]; then
    echo "▶ 全量部署（DEPLOY_FORCE_FULL=1）"
    NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
  elif [[ ! -f "$REV_FILE" ]]; then
    echo "▶ 首次部署（无 $REV_FILE），全量"
    NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
  elif [[ ! -f "$APP_DIR/server.js" ]]; then
    echo "▶ 发布目录无 server.js，全量"
    NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
  else
    DIFF_FROM_RAW="$(head -n1 "$REV_FILE" | tr -d ' \t\r\n')"
    # Resolve whatever is recorded (full SHA, short hash, ref…) to a full commit SHA so
    # the "same commit" comparison below is exact. A short hash recorded by an external
    # wrapper used to fall through to an empty-diff "无待发布变更" and silently skip.
    DIFF_FROM="$(git -C "$SCRIPT_DIR" rev-parse --verify -q "${DIFF_FROM_RAW}^{commit}" 2>/dev/null || true)"
    if [[ -z "$DIFF_FROM_RAW" ]] || [[ -z "$DIFF_FROM" ]]; then
      echo "▶ .adviser-deploy-rev 无效（${DIFF_FROM_RAW:-空}），全量"
      NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
    elif ! git -C "$SCRIPT_DIR" merge-base --is-ancestor "$DIFF_FROM" "$HEAD_NOW" 2>/dev/null; then
      echo "▶ 部署记录与当前历史不一致（rebase/amend），全量"
      NEED_DEPS=1 NEED_BUILD=1 NEED_PRISMA_GEN=1 NEED_MIGRATE=1 NEED_RSYNC_PUBLIC=1
    elif [[ "$DIFF_FROM" == "$HEAD_NOW" ]]; then
      echo "✓ 已与上次部署提交一致（rev=${DIFF_FROM_RAW:0:12} = HEAD ${HEAD_NOW:0:12}），无需构建或同步。"
      # Normalize the marker to the full SHA so an external short/partial hash can't keep
      # re-triggering the empty-diff path on every run.
      if [[ "$DIFF_FROM_RAW" != "$HEAD_NOW" ]]; then
        printf '%s\n' "$HEAD_NOW" >"$REV_FILE"
        echo "▶ 已将 .adviser-deploy-rev 规范化为完整 SHA"
      fi
      exit 0
    else
      echo "▶ 增量比对：rev=${DIFF_FROM:0:12}（记录值 ${DIFF_FROM_RAW:0:12}）→ HEAD=${HEAD_NOW:0:12}"
      NEED_DEPS=0 NEED_BUILD=0 NEED_PRISMA_GEN=0 NEED_MIGRATE=0 NEED_RSYNC_PUBLIC=0
      _DL_N_ALL=0
      _DL_N_REL=0
      git -C "$SCRIPT_DIR" diff --name-only "${DIFF_FROM}..${HEAD_NOW}" | _deploy_local_classify_diff_lines
      echo "▶ 变更文件数：全部=$_DL_N_ALL，运行相关=$_DL_N_REL"

      if [[ "$_DL_N_ALL" -gt 0 ]] && [[ "$_DL_N_REL" -eq 0 ]]; then
        echo "✓ 有新提交但仅文档等非运行路径，跳过构建。（.adviser-deploy-rev 保持不变，下次重新核对）"
        exit 0
      fi

      if [[ "$NEED_DEPS$NEED_BUILD$NEED_PRISMA_GEN$NEED_MIGRATE$NEED_RSYNC_PUBLIC" == "00000" ]]; then
        echo "✓ 无待发布变更。（.adviser-deploy-rev 保持不变，下次重新核对）"
        exit 0
      fi

      echo "▶ 增量 (${DIFF_FROM:0:7}…→${HEAD_NOW:0:7}…) deps=$NEED_DEPS build=$NEED_BUILD prisma_gen=$NEED_PRISMA_GEN migrate=$NEED_MIGRATE public=$NEED_RSYNC_PUBLIC"
    fi
  fi

  [[ -f "$APP_DIR/.env" ]] || die "缺少 $APP_DIR/.env（请先按 .env.example 创建）"

  _ensure_runtime_system_packages

  # Load .env before building so OSS_BUCKET and other vars are available
  # during `next build` and `sync-oss-static.mjs`.
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a

  if [[ "$NEED_DEPS" == 1 ]] || [[ "$NEED_PRISMA_GEN" == 1 ]] || [[ "$NEED_BUILD" == 1 ]]; then
    _deploy_local_maybe_npm_prisma_next "$NEED_DEPS" "$NEED_PRISMA_GEN" "$NEED_BUILD"
    DID_ANY=1
  fi

  if [[ "$NEED_BUILD" == 1 ]] || [[ "$NEED_RSYNC_PUBLIC" == 1 ]] || [[ "$NEED_MIGRATE" == 1 ]]; then
    _deploy_local_sync_to_app_dir "$APP_DIR" "$NEED_BUILD" "$NEED_RSYNC_PUBLIC" "$NEED_MIGRATE"
    DID_ANY=1
    if [[ -f "$APP_DIR/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "$APP_DIR/.env"
      set +a
    fi
  fi

  if [[ "$NEED_MIGRATE" == 1 ]]; then
    _deploy_local_migrate "$APP_DIR"
    DID_ANY=1
  fi

  if [[ "$NEED_BUILD" == 1 ]] || [[ "$NEED_MIGRATE" == 1 ]] || [[ "$NEED_DEPS" == 1 ]] || [[ ! -x "${APP_DIR}/start-prod.sh" ]]; then
    _deploy_local_install_start_pm2 "$APP_DIR"
    DID_ANY=1
  elif [[ "${DID_ANY:-0}" -eq 1 ]] && [[ "$NEED_RSYNC_PUBLIC" == 1 ]]; then
    echo "ℹ️ 仅 public 已同步；按需执行: cd $(printf '%q' "$APP_DIR") && pm2 restart adviser --update-env"
  fi

  if git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf '%s\n' "$(git -C "$SCRIPT_DIR" rev-parse HEAD)" >"$REV_FILE"
    echo "▶ 已写入 $REV_FILE ($(head -n1 "$REV_FILE" | cut -c1-12)…)"
  fi

  echo "✓ 本机部署完成 → $APP_DIR（Nginx 应反代到 127.0.0.1:3000）"
}

# 初始化脚本本体：由 bootstrap（SSH 管道）与 bootstrap-local（本机 bash）共用
_emit_bootstrap_payload() {
  cat <<END_BOOTSTRAP
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REMOTE_DIR='${REMOTE_DIR_ESC}'
DEPLOY_DOMAIN='${DEPLOY_DOMAIN_ESC}'
CERTBOT_EMAIL='${CERTBOT_EMAIL_ESC}'
WITH_PG='${WITH_PG}'
PG_APP_USER='${PG_USER_ESC}'
PG_APP_DB='${PG_DB_ESC}'
PG_PASS_B64='${PG_PASS_B64_ESC}'
BOOTSTRAP_PG_GROUP='${BOOTSTRAP_PG_GROUP_ESC}'

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
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 60s;
    }
}
NGX
}

# 在安装好 postgres 二进制后调用：\$1 = psql 绝对路径（Debian PG16 / RPM PG16）
provision_app_pg_after_server_ready() {
  local pg_bin="\$1"
  [[ "\$WITH_PG" == "1" ]] || return 0
  command -v python3 >/dev/null 2>&1 || { echo "服务器需已安装 python3（bootstrap 会先装）"; exit 1; }
  PG_PASS="\$(printf '%s' "\$PG_PASS_B64" | base64 -d)" || exit 1
  local usr="\$PG_APP_USER"
  local db="\$PG_APP_DB"
  local pw_esc
  pw_esc=\$(PG_PASS="\$PG_PASS" python3 -c "import os; print(os.environ['PG_PASS'].replace(chr(39), chr(39)*2))")

  if sudo -u postgres "\${pg_bin}" -tc "SELECT 1 FROM pg_roles WHERE rolname='\${usr}'" 2>/dev/null | grep -q 1; then
    sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -c "ALTER ROLE \${usr} WITH LOGIN PASSWORD '\${pw_esc}';"
  else
    sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -c "CREATE USER \${usr} WITH PASSWORD '\${pw_esc}';"
  fi

  local grp="\${BOOTSTRAP_PG_GROUP:-}"
  if [[ -n "\${grp}" ]]; then
    if ! sudo -u postgres "\${pg_bin}" -tc "SELECT 1 FROM pg_roles WHERE rolname='\${grp}'" 2>/dev/null | grep -q 1; then
      sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -c "CREATE ROLE \${grp} NOLOGIN;"
    fi
    sudo -u postgres "\${pg_bin}" -c "GRANT \${grp} TO \${usr};" >/dev/null 2>&1 || true
  fi

  if ! sudo -u postgres "\${pg_bin}" -tc "SELECT 1 FROM pg_database WHERE datname='\${db}'" 2>/dev/null | grep -q 1; then
    sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \${db} OWNER \${usr};"
  fi
  sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -d postgres -c "GRANT CONNECT, TEMPORARY ON DATABASE \${db} TO \${usr};"
  if [[ -n "\${grp}" ]]; then
    sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -d postgres -c "GRANT CONNECT, TEMPORARY ON DATABASE \${db} TO \${grp};"
  fi
  sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -q -c "ALTER DATABASE \${db} OWNER TO \${usr};" 2>/dev/null || true
  sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -d "\${db}" -c \\
    "GRANT ALL ON SCHEMA public TO \${usr}; ALTER SCHEMA public OWNER TO \${usr};\\
     ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT ALL ON TABLES TO \${usr};\\
     ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT ALL ON SEQUENCES TO \${usr};\\
     ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT ALL ON FUNCTIONS TO \${usr};\\
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \${usr};\\
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \${usr};\\
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO \${usr};"
  if [[ -n "\${grp}" ]]; then
    sudo -u postgres "\${pg_bin}" -v ON_ERROR_STOP=1 -d "\${db}" -c \\
      "GRANT USAGE ON SCHEMA public TO \${grp};\\
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \${grp};\\
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \${grp};\\
       GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO \${grp};\\
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \${grp};\\
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO \${grp};\\
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO \${grp};\\
       ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \${grp};\\
       ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO \${grp};\\
       ALTER DEFAULT PRIVILEGES FOR ROLE \${usr} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO \${grp};"
  fi
  echo "--> PostgreSQL 用户/库/授权就绪: \$usr / \$db（组角色 BOOTSTRAP_PG_GROUP=\${grp:-（未设置）}）"
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
    build-essential python3 poppler-utils fonts-noto-cjk

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
    echo "==> 停止并卸载系统已有 PostgreSQL（重要：请先备份旧数据目录，如 /etc/postgresql/、/var/lib/postgresql）..."
    systemctl stop postgresql 2>/dev/null || true
    systemctl disable postgresql 2>/dev/null || true
    systemctl stop postgresql@16-main 2>/dev/null || true
    DEBIAN_FRONTEND=noninteractive apt-get -y purge 'postgresql-*' 2>/dev/null || true
    DEBIAN_FRONTEND=noninteractive apt-get -y autoremove --purge || true

    apt-get install -y --no-install-recommends gnupg

    echo "==> 添加 PGDG APT 并安装 PostgreSQL 16..."
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --batch --yes --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg
    # shellcheck disable=SC1091
    . /etc/os-release
    CODENAME="\${VERSION_CODENAME:?缺少 VERSION_CODENAME，无法用 PGDG 源}"
    echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] https://apt.postgresql.org/pub/apt \${CODENAME}-pgdg main" >/etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 postgresql-contrib-16

    PG_SQL_DEB="/usr/lib/postgresql/16/bin/psql"
    if systemctl list-unit-files 2>/dev/null | grep -q '^postgresql@16-main.service'; then
      systemctl enable postgresql@16-main
      systemctl start postgresql@16-main
    else
      systemctl restart postgresql 2>/dev/null || true
    fi

    provision_app_pg_after_server_ready "\$PG_SQL_DEB"
    echo "PostgreSQL 16 已通过 PGDG 安装；通常为 systemctl enable --now postgresql@16-main"
  fi

  if [[ -n "\$DEPLOY_DOMAIN" && -n "\$CERTBOT_EMAIL" ]]; then
    echo "==> Certbot (Let's Encrypt)..."
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx -d "\$DEPLOY_DOMAIN" --non-interactive --agree-tos -m "\$CERTBOT_EMAIL" --redirect || \
      echo "Certbot 失败（请检查域名 DNS 是否指向本机 80 端口）"
  fi
else
  echo "==> [RHEL 系] 安装基础包 (\"\${PM[*]}\")..."
  "\${PM[@]}" install ca-certificates curl gnupg2 git rsync nginx openssl python3 gcc gcc-c++ make firewalld poppler-utils ||
    "\${PM[@]}" install ca-certificates curl gnupg2 git rsync nginx openssl python3 gcc gcc-c++ make poppler-utils

  if ! "\${PM[@]}" install google-noto-cjk-fonts 2>/dev/null; then
    "\${PM[@]}" install google-noto-sans-cjk-ttc-fonts google-noto-serif-cjk-ttc-fonts 2>/dev/null || \\
      echo "⚠ 未能安装 Noto CJK 字体 — DDR 含中文时可能失败"
  fi

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
    echo "==> 停止并卸载系统已有 PostgreSQL（请先备份旧数据目录，如 /var/lib/pgsql）..."
    for svc in postgresql postgresql-15 postgresql-14 postgresql-13 postgresql-12 rh-postgresql10-postgresql; do
      systemctl stop "\${svc}" 2>/dev/null || true
      systemctl disable "\${svc}" 2>/dev/null || true
    done
    for _pkg in \$(rpm -qa | grep -E '^postgresql[0-9]+-server' | grep -v '^postgresql16-' || true); do
      [[ -z "\$_pkg" ]] && continue
      "\${PM[@]}" remove -y "\${_pkg}" 2>/dev/null || true
    done
    "\${PM[@]}" remove -y postgresql-server postgresql postgresql-contrib postgresql-docs postgresql-upgrade 2>/dev/null || true

    echo "==> 安装 PostgreSQL 16（PostgreSQL 官方 PGDG）..."
    ARCH="\$(uname -m)"
    case "\$ARCH" in
      x86_64) PGDG_ARCH=x86_64 ;;
      aarch64) PGDG_ARCH=aarch64 ;;
      *) echo "不支持的架构: \$ARCH"; exit 1 ;;
    esac

    RPM_EL="\$(rpm -E '%{rhel}' 2>/dev/null || true)"
    if ! [[ "\${RPM_EL}" =~ ^[0-9]+\$ ]]; then
      RPM_EL=""
      if [[ -r /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        case "\${PLATFORM_ID:-}" in
          platform:el9*|platform:al9*) RPM_EL=9 ;;
          platform:el8*|platform:al8*) RPM_EL=8 ;;
          platform:el7*) RPM_EL=7 ;;
        esac
        if [[ -z "\$RPM_EL" && "\${ID:-}" == "alinux" ]]; then
          case "\${VERSION_ID%%.*}" in
            2) RPM_EL=7 ;;
            *) RPM_EL=8 ;;
          esac
        fi
        if [[ -z "\$RPM_EL" && "\${ID:-}" == "amzn" && "\${VERSION_ID:-}" == "2023" ]]; then
          RPM_EL=9
        fi
      fi
    fi

    # 阿里云 Linux 的 VERSION_ID 常为 3/4；dnf yum 占位符字面量易被当成 rhel-3 URL。下同按 PLATFORM_ID 覆盖 EL 代号。
    if [[ -r /etc/os-release ]]; then
      # shellcheck disable=SC1091
      . /etc/os-release
      if [[ "\${ID:-}" == "alinux" ]]; then
        case "\${PLATFORM_ID:-}" in
          platform:el9*|platform:al9*) RPM_EL=9 ;;
          platform:el8*|platform:al8*) RPM_EL=8 ;;
          platform:el7*|platform:al7*) RPM_EL=7 ;;
        esac
      fi
    fi

    if [[ -z "\$RPM_EL" ]]; then
      echo "无法推断用于 PGDG 的 EL 主版本（请查看 /etc/os-release；阿里云 Linux 3 常为 EL8）。请改用托管数据库或手动安装 PostgreSQL 16。"
      exit 1
    fi

    PGDG_REPORPM="https://download.postgresql.org/pub/repos/yum/reporpms/EL-\${RPM_EL}-\${PGDG_ARCH}/pgdg-redhat-repo-latest.noarch.rpm"
    echo "--> PGDG 仓库 RPM: \$PGDG_REPORPM"

    command -v dnf >/dev/null 2>&1 && { dnf -qy module disable postgresql 2>/dev/null || true; }

    "\${PM[@]}" install -y "\$PGDG_REPORPM"

    echo "--> 将 PGDG 仓库 yum 里「美元符 + releasever」占位符重写为 EL\${RPM_EL}（避免阿里云等误用 rhel-3 仓库 404）..."
    export RPM_EL
    _dyn_rel=\$'\044releasever'
    for _pgdg_repo in /etc/yum.repos.d/pgdg*.repo; do
      [[ -e "\${_pgdg_repo}" ]] || continue
      grep -Fq "\${_dyn_rel}" "\${_pgdg_repo}" 2>/dev/null || continue
      sed -i "s|\${_dyn_rel}|\${RPM_EL}|g" "\${_pgdg_repo}"
    done

    if command -v dnf >/dev/null 2>&1; then dnf clean all || true; else yum clean all || true; fi

    "\${PM[@]}" install -y postgresql16-server postgresql16 || \\
      { echo "安装 postgresql16-server / postgresql16 失败"; exit 1; }

    PG_SETUP="/usr/pgsql-16/bin/postgresql-16-setup"
    PG_DATA="/var/lib/pgsql/16/data"
    if [[ -x "\$PG_SETUP" ]] && [[ ! -f "\$PG_DATA/PG_VERSION" ]]; then
      "\$PG_SETUP" initdb
    fi

    systemctl enable postgresql-16
    systemctl start postgresql-16

    PG_SQL="/usr/pgsql-16/bin/psql"
    provision_app_pg_after_server_ready "\$PG_SQL"
    echo "已安装 PostgreSQL 16（postgresql-16）；.env DATABASE_URL 请使用上述用户 / 数据库名。"
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

if [[ -f "\${REMOTE_DIR}/scripts/ensure-system-packages.sh" ]]; then
  bash "\${REMOTE_DIR}/scripts/ensure-system-packages.sh" || true
elif [[ -f "./scripts/ensure-system-packages.sh" ]]; then
  bash "./scripts/ensure-system-packages.sh" || true
else
  echo "（未找到 ensure-system-packages.sh，已在上文 apt/dnf 中安装 poppler-utils / CJK 字体）"
fi

nginx -t
systemctl reload nginx 2>/dev/null || systemctl restart nginx
systemctl enable nginx

echo ""
if [[ "\$WITH_PG" != "1" ]]; then
  echo "[!] 未安装 PostgreSQL：当前未设置 BOOTSTRAP_WITH_POSTGRES=1，Prisma/deploy-local 无法在 127.0.0.1:5432 连上数据库。"
  echo "    需要本机库时请执行（与 /opt/adviser-app/.env 中 DATABASE_URL 一致）:"
  echo "      export BOOTSTRAP_WITH_POSTGRES=1"
  echo "      export BOOTSTRAP_DATABASE_URL='postgresql://用户:密码@127.0.0.1:5432/库名'"
  echo "    或: POSTGRES_APP_USER / POSTGRES_APP_DB / POSTGRES_APP_PASSWORD"
  echo "      sudo ./deploy.sh bootstrap-local"
  echo ""
fi
echo "===== Bootstrap 完成 ====="
echo "1. 在 \$REMOTE_DIR 创建 .env（参考仓库 .env.example）"
echo "2. 在笔记本: DEPLOY_HOST=... ./deploy.sh deploy — 或在服务器仓库目录: ./deploy.sh deploy-local"
END_BOOTSTRAP
}

_bootstrap_prepare_env() {
  local with_postgres="${BOOTSTRAP_WITH_POSTGRES:-0}"
  REMOTE_DIR_ESC="${REMOTE_DIR}"
  DEPLOY_DOMAIN_ESC="${DEPLOY_DOMAIN:-}"
  CERTBOT_EMAIL_ESC="${CERTBOT_EMAIL:-}"
  WITH_PG="${with_postgres}"
  PG_USER_ESC="${POSTGRES_APP_USER:-adviser}"
  PG_DB_ESC="${POSTGRES_APP_DB:-adviser_db}"
  BOOTSTRAP_PG_GROUP_ESC="${BOOTSTRAP_PG_GROUP:-}"
  PG_PASS_B64_ESC=""
  PG_PASS=""
  if [[ "${with_postgres}" == "1" ]]; then
    _bootstrap_resolve_pg_credentials
  fi
}

# 全新服务器「本机」执行：系统栈与 Nginx；勿设 DEPLOY_HOST（与 deploy-local 同属本机闭环）
cmd_bootstrap_local() {
  _bootstrap_prepare_env
  [[ "$(id -u)" -eq 0 ]] || die "bootstrap-local 需在服务器上以 root 执行（例如 sudo ./deploy.sh bootstrap-local）"
  echo "▶ 在本机执行系统初始化（自动识别 apt / dnf / yum）..."
  _emit_bootstrap_payload | bash
  echo "✓ 本机系统依赖与 Nginx 已就绪（勿忘在 ${REMOTE_DIR} 放置 .env）"
}

# 在笔记本/CI 运行：SSH 登录 DEPLOY_HOST 后管道执行与同 bootstrap-local 相同的脚本
cmd_bootstrap() {
  require_deploy_host
  _bootstrap_prepare_env
  echo "▶ 经 SSH 在 ${REMOTE} 上执行系统初始化..."
  _emit_bootstrap_payload | ssh_remote "bash -s"
  echo "✓ ${REMOTE} 系统依赖与 Nginx 已就绪"
}

usage() {
  sed -n '2,62p' "$0" | tail -n +2
}

main() {
  local sub="${1:-deploy}"
  case "$sub" in
    check)   cmd_check ;;
    build)   cmd_build ;;
    deploy)       cmd_deploy ;;
    deploy-local) cmd_deploy_local ;;
    bootstrap-local) cmd_bootstrap_local ;;
    bootstrap)       cmd_bootstrap ;;
    -h|--help|help) usage ;;
    *) die "未知命令: $sub。使用: $0 check | build | deploy | deploy-local | bootstrap-local | bootstrap | help" ;;
  esac
}

main "$@"
