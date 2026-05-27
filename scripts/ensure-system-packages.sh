#!/usr/bin/env bash
# Install OS packages required at runtime (NAR1/PDF analysis, KYC, DDR, etc.).
# Called from deploy.sh bootstrap / deploy / deploy-local. Idempotent.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo -E bash "$0" "$@"
  fi
  echo "错误: 需要 root 或 sudo 才能安装系统包" >&2
  exit 1
fi

install_deb() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends poppler-utils fonts-noto-cjk
}

install_rpm() {
  local pm=(dnf -y)
  command -v dnf >/dev/null 2>&1 || pm=(yum -y)

  "${pm[@]}" install poppler-utils

  if ! "${pm[@]}" install google-noto-cjk-fonts 2>/dev/null; then
    "${pm[@]}" install google-noto-sans-cjk-ttc-fonts google-noto-serif-cjk-ttc-fonts 2>/dev/null || \
      echo "⚠ 未能安装 Noto CJK 字体包 — DDR 含中文时可能失败（可手动安装 google-noto-cjk-fonts）"
  fi
}

echo "==> 安装/确认运行时系统依赖（PDF 分析、NAR1、DDR）…"

if command -v apt-get >/dev/null 2>&1; then
  install_deb
elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
  install_rpm
else
  echo "未识别 apt-get / dnf / yum，请手动安装: poppler-utils、fonts-noto-cjk（或 google-noto-cjk-fonts）" >&2
  exit 1
fi

missing=0
for cmd in pdftoppm pdftotext; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $cmd → $(command -v "$cmd")"
  else
    echo "⚠ $cmd 未找到 — 多页 PDF 文本/图像分析可能受限" >&2
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  exit 1
fi

echo "✓ 运行时系统依赖就绪"
