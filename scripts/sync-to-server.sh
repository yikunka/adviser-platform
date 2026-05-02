#!/usr/bin/env bash
# ============================================================================
# 本地项目 → 服务器 rsync 同步（不依赖 git）
#
# 必设:
#   DEPLOY_HOST          服务器 IP 或域名
#
# 可选:
#   DEPLOY_USER             默认 root
#   DEPLOY_SSH_KEY          私钥路径（与密码二选一；不设密码时用密钥）
#   DEPLOY_SSH_PASSWORD     SSH 密码（需本机安装 sshpass；与标准环境变量 SSHPASS 二选一）
#   REMOTE_PROJECT_DIR      服务器同步目录，默认 /home/adviser-platform
#
# sshpass 安装: macOS: brew install hudochenkov/sshpass/sshpass | apt: sshpass | yum: sshpass
#
# 用法示例（密码）:
#   export DEPLOY_HOST=1.2.3.4
#   export DEPLOY_SSH_PASSWORD='你的密码'
#   ./scripts/sync-to-server.sh --deploy
#   ./scripts/sync-to-server.sh              # 仅同步源码（推荐日常）
#   ./scripts/sync-to-server.sh --dry-run    # 只看会传哪些文件
#   ./scripts/sync-to-server.sh --delete    # 删除远端有、本地没有的项（慎用）
#   ./scripts/sync-to-server.sh --deploy     # 同步后 SSH 执行 ./deploy.sh deploy-local
#
# 不会同步: .git、node_modules、.next、各类 .env（避免覆盖服务器上的密钥与环境）
# 服务器上需在 /opt/adviser-app（或 deploy 使用的目录）自行维护 .env。
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

die() { echo "错误: $*" >&2; exit 1; }

DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/adviser-platform}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

# 密码与密钥：二选一；设了密码则走 sshpass，并关闭公钥尝试以免卡住
USE_PASSWORD=0
if [[ -n "${DEPLOY_SSH_PASSWORD:-${SSHPASS:-}}" ]]; then
  command -v sshpass >/dev/null 2>&1 || die "已设置 DEPLOY_SSH_PASSWORD 或 SSHPASS，请先安装 sshpass（见脚本头注释）"
  export SSHPASS="${DEPLOY_SSH_PASSWORD:-$SSHPASS}"
  USE_PASSWORD=1
  SSH_OPTS+=(-o PreferredAuthentications=password -o PubkeyAuthentication=no)
elif [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "${DEPLOY_SSH_KEY}")
fi

require_host() {
  [[ -n "${DEPLOY_HOST:-}" ]] || { echo "错误: 请设置 DEPLOY_HOST" >&2; exit 1; }
}

ssh_remote() {
  if [[ "$USE_PASSWORD" == 1 ]]; then
    sshpass -e ssh "${SSH_OPTS[@]}" "$@"
  else
    ssh "${SSH_OPTS[@]}" "$@"
  fi
}

rsync_rsh() {
  local s=""
  if [[ "$USE_PASSWORD" == 1 ]]; then
    s="sshpass -e "
  fi
  s+="ssh"
  for x in "${SSH_OPTS[@]}"; do s+=" $(printf '%q' "$x")"; done
  printf '%s' "$s"
}

DRY_RUN=()
DELETE_FLAG=()
DO_DEPLOY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=(--dry-run) ;;
    --delete)  DELETE_FLAG=(--delete) ;;
    --deploy)  DO_DEPLOY=1 ;;
    -h|--help)
      sed -n '2,35p' "$0" | tail -n +2
      exit 0
      ;;
    *) echo "未知参数: $1（可用 --dry-run / --delete / --deploy）" >&2; exit 1 ;;
  esac
  shift
done

require_host
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "▶ 同步目录: $REPO_ROOT/ → ${REMOTE}:${REMOTE_PROJECT_DIR}/"

ssh_remote "$REMOTE" "mkdir -p \"$REMOTE_PROJECT_DIR\""

RSYNC_EXCLUDES=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='.next'
  --exclude='out'
  --exclude='.turbo'
  --exclude='coverage'
  --exclude='.env'
  --exclude='.env.local'
  --exclude='.env.*.local'
  --exclude='*.swp'
  --exclude='.DS_Store'
  --exclude='aml-downloads'
)

rsync -az "${DRY_RUN[@]}" "${DELETE_FLAG[@]}" -e "$(rsync_rsh)" \
  "${RSYNC_EXCLUDES[@]}" \
  "$REPO_ROOT/" "${REMOTE}:${REMOTE_PROJECT_DIR}/"

if [[ ${#DRY_RUN[@]} -gt 0 ]]; then
  echo "✓ dry-run 结束（未传输）"
  exit 0
fi

echo "✓ 文件已同步"

if [[ "$DO_DEPLOY" == 1 ]]; then
  echo "▶ 远程执行 deploy-local …"
  ssh_remote "$REMOTE" "cd \"${REMOTE_PROJECT_DIR}\" && chmod +x deploy.sh 2>/dev/null || true && ./deploy.sh deploy-local"
fi
