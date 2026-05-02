# 6AM Advisory Platform — Deployment Operation Manual

## 目錄 Table of Contents

1. [環境需求 Requirements](#1-環境需求)
2. [本地開發環境 — macOS (Homebrew)](#2-本地開發環境--macos-homebrew)
3. [本地開發環境 — Linux / Docker](#3-本地開發環境--linux--docker)
4. [生產伺服器初始設定](#4-生產伺服器初始設定)
5. [Docker Compose 部署方式（推薦）](#5-docker-compose-部署方式推薦)
6. [裸機 PM2 部署方式（無 Docker）](#6-裸機-pm2-部署方式無-docker)
7. [資料庫管理](#7-資料庫管理)
8. [Cloudflare R2 設定](#8-cloudflare-r2-設定)
9. [SSL 憑證 Let's Encrypt](#9-ssl-憑證-lets-encrypt)
10. [日常維護操作](#10-日常維護操作)
11. [故障排除 Troubleshooting](#11-故障排除)
12. [快速參考卡](#12-快速參考卡)

---

## 1. 環境需求

| 項目 | 本地開發 | 生產伺服器 |
|------|----------|------------|
| Node.js | 22 LTS | 22 LTS |
| npm | 10+ | 10+ |
| PostgreSQL | 16 | 16 |
| Docker | 可選（Linux 推薦） | 建議 |
| Nginx | 不需要 | 必須 |
| RAM | 4 GB+ | 最低 2 GB |
| CPU | 任意 | 2 核心 |

**外部服務帳戶需預先準備（生產環境）：**
- [Cloudflare R2](https://dash.cloudflare.com) — 文件儲存（免費 10 GB/月）
- [Resend](https://resend.com) — 發送電郵（免費 3,000 封/月）
- 域名 + DNS 控制權

> **開發環境可不配置 R2 與 Resend** — 留空時文件上傳會報錯，但其他功能正常運作。

---

## 2. 本地開發環境 — macOS (Homebrew)

> ✅ 此流程為實際驗證過的部署路徑。

### 2.1 前置：安裝 PostgreSQL 16

```bash
brew install postgresql@16
```

### 2.2 Clone 專案並安裝依賴

```bash
git clone <repo-url> adviser-platform
cd adviser-platform
npm install
```

### 2.3 啟動 PostgreSQL 並建立資料庫

```bash
# 啟動 PostgreSQL（開機後需手動執行一次；或設定開機自動啟動）
brew services start postgresql@16

# 確認已就緒
/opt/homebrew/opt/postgresql@16/bin/pg_isready

# 建立 adviser 用戶和資料庫
psql postgres -c "CREATE USER adviser WITH PASSWORD 'devpassword';"
psql postgres -c "CREATE DATABASE adviser_db OWNER adviser;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE adviser_db TO adviser;"
```

> 若 `psql` 找不到，用全路徑：`/opt/homebrew/opt/postgresql@16/bin/psql`

### 2.4 設定環境變數

**重要：必須同時更新兩個檔案。**

- **`.env`** — 由 Prisma CLI（`prisma.config.ts` 中的 `dotenv/config`）讀取，用於 `db push` / `migrate` / `seed` 等指令。
- **`.env.local`** — 由 Next.js dev server 讀取，覆蓋 `.env`。

**步驟一：更新 `.env` 中的 DATABASE_URL**

```bash
# .env 已存在，只需把 DATABASE_URL 改為正確值
sed -i '' 's|DATABASE_URL=.*|DATABASE_URL="postgresql://adviser:devpassword@localhost:5432/adviser_db"|' .env
```

或直接編輯 `.env`，確保這一行正確：

```env
DATABASE_URL="postgresql://adviser:devpassword@localhost:5432/adviser_db"
```

**步驟二：建立 `.env.local`**

```bash
cat > .env.local << 'EOF'
# ── Database ────────────────────────────────
DATABASE_URL="postgresql://adviser:devpassword@localhost:5432/adviser_db"

# ── Auth.js v5 ──────────────────────────────
AUTH_SECRET="dev-secret-key-32chars-local-only"
NEXTAUTH_URL="http://localhost:3000"

# ── Cloudflare R2（開發可留空）──────────────
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="adviser-docs-dev"
R2_PUBLIC_URL=""

# ── Resend（開發可留空）─────────────────────
RESEND_API_KEY=""
EMAIL_FROM="onboarding@resend.dev"

# ── App ─────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
CRON_SECRET="dev-cron-secret"
EOF
```

### 2.5 初始化資料庫

```bash
# 生成 Prisma client
npx prisma generate

# 建立所有資料表（首次，尚無 migration 檔案時用 db push）
npx prisma db push

# Seed 初始資料（13 個 AML 名單來源 + Super Admin）
npx tsx prisma/seed.ts
```

> **`db push` vs `migrate`**
> - 首次或開發中快速同步 schema → 用 `npx prisma db push`
> - 需要保留 migration 歷史（生產環境）→ 用 `npm run db:migrate` 建立 migration 檔，再 `npm run db:deploy` 套用
> - 目前 `prisma/migrations/` 為空，代表尚未建立 migration 歷史

### 2.6 啟動開發服務器

```bash
npm run dev
```

瀏覽器開啟 `http://localhost:3000` → 自動跳轉 `/zh`。

啟動成功時 terminal 應看到：

```
▲ Next.js 16.x.x (Turbopack)
- Local: http://localhost:3000
✓ Ready in xxxms
[Scheduler] Scheduled daily job at 02:00 HKT (18:00 UTC)
```

**預設帳號：**

| 角色 | Email | Password |
|------|-------|----------|
| Super Admin | `admin@6amadvise.com` | `ChangeMe@2026!` |

> ⚠️ 正式上線前務必修改！

### 2.7 停止服務

```bash
# 停止 Next.js dev server（Ctrl+C 即可；或強制終止）
kill $(lsof -ti:3000)

# 停止 PostgreSQL（下次開發時再 start）
brew services stop postgresql@16

# 設定開機自動啟動 PostgreSQL（可選）
brew services enable postgresql@16
```

### 2.8 開發常用指令

```bash
npm run dev           # 啟動開發服務器（熱更新）
npm run db:studio     # 開啟 Prisma Studio GUI → http://localhost:5555
npm run db:migrate    # 建立新 migration（schema 改動後執行）
npm run lint          # ESLint 檢查
npx tsc --noEmit      # TypeScript 類型檢查（不輸出檔案）
npm run build         # 本地驗證 production build
```

---

## 3. 本地開發環境 — Linux / Docker

### 3.1 Clone 專案並安裝依賴

```bash
git clone <repo-url> adviser-platform
cd adviser-platform
npm install
```

### 3.2 啟動 PostgreSQL 容器

```bash
docker run -d \
  --name adviser-db-dev \
  -e POSTGRES_USER=adviser \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=adviser_db \
  -p 5432:5432 \
  postgres:16-alpine \
  postgres \
    -c shared_buffers=128MB \
    -c max_connections=50

# 確認啟動成功
docker exec adviser-db-dev pg_isready -U adviser
```

### 3.3 設定環境變數

同 [2.4](#24-設定環境變數) — 同樣需要更新 `.env` 和建立 `.env.local` 兩個檔案。

### 3.4 初始化資料庫

```bash
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 3.5 啟動開發服務器

```bash
npm run dev
```

### 3.6 停止服務

```bash
kill $(lsof -ti:3000)              # 停止 Next.js
docker stop adviser-db-dev         # 停止 DB 容器
docker start adviser-db-dev        # 下次開發時重啟 DB
```

---

## 4. 生產伺服器初始設定

以 **Ubuntu 22.04 LTS** 為例，首次登入後執行：

```bash
# 建立部署用戶
adduser deploy
usermod -aG sudo deploy
su - deploy

# 安裝 Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝 Docker & Docker Compose plugin
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy

# 安裝 Nginx & Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 安裝 PM2（僅裸機部署需要）
sudo npm install -g pm2

# 建立備份目錄
sudo mkdir -p /opt/backups
sudo chown deploy:deploy /opt/backups
```

重新登入讓 docker 群組生效：

```bash
exit
su - deploy
docker ps   # 應無報錯
```

---

## 5. Docker Compose 部署方式（推薦）

App + DB 全部容器化，最簡單，適合生產環境。

### 5.1 上傳代碼

```bash
git clone <repo-url> /opt/adviser
cd /opt/adviser
```

### 5.2 建立生產環境變數

```bash
cp .env.example .env
nano .env
```

填入所有真實的值：

```env
# ── 資料庫 ─────────────────────────────────
DATABASE_URL="postgresql://adviser:YOUR_STRONG_PASSWORD@db:5432/adviser_db"
POSTGRES_PASSWORD="YOUR_STRONG_PASSWORD"

# ── Auth ────────────────────────────────────
AUTH_SECRET="paste-output-of: openssl rand -base64 32"
NEXTAUTH_URL="https://yourdomain.com"

# ── Cloudflare R2 ───────────────────────────
R2_ACCOUNT_ID="xxxx"
R2_ACCESS_KEY_ID="xxxx"
R2_SECRET_ACCESS_KEY="xxxx"
R2_BUCKET_NAME="adviser-docs"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"

# ── Resend ──────────────────────────────────
RESEND_API_KEY="re_xxxx"
EMAIL_FROM="noreply@yourdomain.com"

# ── App ─────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
CRON_SECRET="paste-output-of: openssl rand -hex 32"
```

生成隨機密鑰：

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
```

### 5.3 首次啟動

```bash
cd /opt/adviser

# 建置 image 並啟動
docker compose up -d --build

# 跟蹤日誌，等待 db 進入 healthy 狀態（約 15–30 秒）
docker compose logs -f

# db healthy 後初始化（僅首次執行）
docker compose exec app npx prisma db push
docker compose exec app npx tsx prisma/seed.ts
```

### 5.4 確認服務運行

```bash
docker compose ps
# 預期：adviser-app running, adviser-db running (healthy)

curl -I http://localhost:3000
# 預期：HTTP 200 或 307
```

### 5.5 設定 Nginx 反向代理

```bash
# 臨時 HTTP 設定（用於取得 SSL 憑證）
sudo tee /etc/nginx/sites-available/adviser > /dev/null << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/adviser /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 取得 SSL 憑證
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive

# 替換為完整生產 nginx 設定（含 SSL、gzip、安全 headers）
sudo cp /opt/adviser/nginx.conf /etc/nginx/sites-available/adviser
sudo sed -i 's/yourdomain\.com/your-actual-domain.com/g' \
  /etc/nginx/sites-available/adviser

sudo nginx -t && sudo systemctl reload nginx
```

### 5.6 後續更新部署

```bash
cd /opt/adviser
git pull origin main
docker compose up -d --build

# 如有 schema 變更
docker compose exec app npx prisma db push   # 或 migrate deploy（有 migration 檔時）

# 確認
docker compose ps
docker compose logs --tail=50 app
```

---

## 6. 裸機 PM2 部署方式（無 Docker）

### 6.1 安裝並設定 PostgreSQL 16

```bash
sudo apt-get install -y postgresql-16 postgresql-client-16

sudo -u postgres psql << 'EOF'
CREATE USER adviser WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE adviser_db OWNER adviser;
GRANT ALL PRIVILEGES ON DATABASE adviser_db TO adviser;
EOF

# 針對 2 GB RAM 優化
sudo tee -a /etc/postgresql/16/main/postgresql.conf > /dev/null << 'EOF'

# 6AM Advisory tuning
shared_buffers = 128MB
work_mem = 4MB
effective_cache_size = 512MB
max_connections = 50
maintenance_work_mem = 32MB
checkpoint_completion_target = 0.9
wal_buffers = 4MB
EOF

sudo systemctl restart postgresql
```

### 6.2 建置 Next.js

```bash
cd /opt/adviser

npm ci --omit=dev
npx prisma generate
npm run build

# 複製靜態資源到 standalone 目錄（必須）
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 首次初始化
npx prisma db push
npx tsx prisma/seed.ts
```

### 6.3 建立 PM2 設定

```bash
cat > /opt/adviser/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'adviser',
    script: '.next/standalone/server.js',
    instances: 1,
    exec_mode: 'fork',
    cwd: '/opt/adviser',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
    },
    max_memory_restart: '800M',
    error_file: '/var/log/adviser/error.log',
    out_file: '/var/log/adviser/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    wait_ready: true,
    listen_timeout: 15000,
    kill_timeout: 5000,
  }]
}
EOF

sudo mkdir -p /var/log/adviser
sudo chown deploy:deploy /var/log/adviser
```

### 6.4 啟動 PM2

```bash
pm2 start ecosystem.config.js

# 開機自動啟動
pm2 startup   # 按輸出提示執行 sudo 指令
pm2 save

pm2 status
pm2 logs adviser --lines 50
```

### 6.5 後續更新

```bash
cd /opt/adviser
git pull origin main

npm ci --omit=dev
npx prisma generate
npm run build

cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 如有 schema 變更
npx prisma db push   # 或 prisma migrate deploy（有 migration 檔時）

pm2 reload adviser   # 零停機優雅重啟
```

---

## 7. 資料庫管理

### `db push` vs `migrate`（重要）

| 情境 | 指令 | 說明 |
|------|------|------|
| 首次建表 / 快速開發同步 | `npx prisma db push` | 直接套用 schema，不建立 migration 檔 |
| 開發中建立 migration 歷史 | `npm run db:migrate` | 互動式建立 migration 檔並套用 |
| 生產環境套用已有 migration | `npm run db:deploy` | 非互動，套用 `prisma/migrations/` 中的檔案 |

> 目前 `prisma/migrations/` 為空，生產部署使用 `npx prisma db push` 即可。
> 如需 migration 歷史（便於追蹤 schema 變更），在開發環境執行 `npm run db:migrate` 後 commit migration 檔案。

### Schema 有改動時

```bash
# 開發環境（快速同步，不留 migration 記錄）
npx prisma db push

# 開發環境（建立 migration 檔，commit 後生產可用 migrate deploy）
npm run db:migrate
# 輸入 migration 名稱，例如：add_annual_filing_table
```

### 備份資料庫

```bash
# Docker 方式
docker compose exec -T db pg_dump -U adviser adviser_db \
  | gzip > /opt/backups/adviser_$(date +%Y%m%d_%H%M).sql.gz

# 裸機方式（macOS Homebrew）
/opt/homebrew/opt/postgresql@16/bin/pg_dump \
  -U adviser -h localhost adviser_db \
  | gzip > ~/adviser_backup_$(date +%Y%m%d_%H%M).sql.gz

# 裸機方式（Linux）
pg_dump -U adviser -h localhost adviser_db \
  | gzip > /opt/backups/adviser_$(date +%Y%m%d_%H%M).sql.gz
```

每日自動備份（生產 Linux）：

```bash
sudo crontab -e
# 加入（每天 03:00，保留 30 天）：
# 0 3 * * * docker compose -f /opt/adviser/docker-compose.yml exec -T db \
#   pg_dump -U adviser adviser_db \
#   | gzip > /opt/backups/adviser_$(date +\%Y\%m\%d).sql.gz
# 0 4 * * * find /opt/backups -name "*.sql.gz" -mtime +30 -delete
```

### 還原備份

```bash
# Docker
gunzip -c /opt/backups/adviser_20240101_0300.sql.gz \
  | docker compose exec -T db psql -U adviser adviser_db

# 裸機 Linux
gunzip -c /opt/backups/adviser_20240101_0300.sql.gz \
  | psql -U adviser -h localhost adviser_db

# macOS Homebrew
gunzip -c ~/adviser_backup_20240101.sql.gz \
  | /opt/homebrew/opt/postgresql@16/bin/psql -U adviser adviser_db
```

### Prisma Studio

```bash
# 本地（任何環境）
npm run db:studio   # → http://localhost:5555

# 生產（透過 SSH tunnel，勿直接對外開放）
ssh -L 5555:localhost:5555 deploy@your-server-ip
# 伺服器上執行：
cd /opt/adviser && npx prisma studio --port 5555
```

---

## 8. Cloudflare R2 設定

### 8.1 建立 Bucket

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. 名稱：`adviser-docs`，Location：`APAC`

### 8.2 建立 API Token

1. R2 → **Manage R2 API tokens** → **Create API token**
2. 權限：`Object Read & Write`，限定 bucket：`adviser-docs`
3. 複製 **Access Key ID** 和 **Secret Access Key**

### 8.3 取得 Account ID

Dashboard 右上角 → **Account ID**

### 8.4 設定 CORS

Bucket → **Settings** → **CORS Policy**：

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### 8.5 （可選）自訂域名

Bucket → **Settings** → **Custom Domains** → 綁定 `files.yourdomain.com`，
並更新 `.env` 中的 `R2_PUBLIC_URL="https://files.yourdomain.com"`

---

## 9. SSL 憑證 Let's Encrypt

```bash
# 首次取得
sudo certbot --nginx \
  -d yourdomain.com -d www.yourdomain.com \
  --email your@email.com --agree-tos --non-interactive

# 測試自動續期
sudo certbot renew --dry-run

# 查看續期 timer
sudo systemctl status certbot.timer
```

憑證有效期 90 天，Certbot 自動在到期前 30 天續期。

---

## 10. 日常維護操作

### 查看日誌

```bash
# Docker
docker compose logs -f app             # 即時跟蹤
docker compose logs --tail=200 app     # 最近 200 行

# PM2
pm2 logs adviser                       # 即時跟蹤
pm2 logs adviser --lines 200

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 手動觸發 AML 制裁名單拉取

```bash
# 用 CRON_SECRET（推薦）
curl -X POST https://yourdomain.com/api/cron/aml \
  -H "x-cron-secret: YOUR_CRON_SECRET"

# 本地開發測試
curl -X POST http://localhost:3000/api/cron/aml \
  -H "x-cron-secret: dev-cron-secret"
```

### 重啟服務

```bash
docker compose restart app   # Docker
pm2 reload adviser           # PM2（零停機）
```

### 監控資源

```bash
docker stats     # Docker 容器 CPU/RAM
pm2 monit        # PM2 監控儀表板
htop             # 系統整體資源
df -h            # 磁碟空間
free -h          # 記憶體
```

### 建立 Swap（2 GB 伺服器建議）

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 11. 故障排除

### ❌ `PrismaClientInitializationError: needs to be constructed with adapter`

**原因：** `PrismaClient` 直接 `new PrismaClient()` 而未傳入 adapter，Prisma 7 必須使用 `PrismaPg` adapter。

**解法：** 確認 `prisma/seed.ts` 開頭為：

```ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
```

任何直接實例化 `PrismaClient` 的檔案（seed、腳本等）都需要同樣處理。應用程式本體使用 `src/lib/db/prisma.ts` 中的 singleton，已正確配置。

---

### ❌ Prisma CLI 報 `P1001: Can't reach database server`

**原因：** `.env` 中的 `DATABASE_URL` 仍是預設佔位值（`johndoe:randompassword@localhost:5432/mydb`）。Prisma CLI 讀 `.env`（透過 `prisma.config.ts` 中的 `dotenv/config`），不讀 `.env.local`。

**解法：** 確認 `.env` 中的 `DATABASE_URL` 已更新為正確值：

```env
DATABASE_URL="postgresql://adviser:devpassword@localhost:5432/adviser_db"
```

---

### ❌ `No migration found in prisma/migrations`

**原因：** `prisma/migrations/` 目錄為空，尚未建立 migration 歷史，`prisma migrate deploy` 沒有檔案可套用。

**解法：** 首次建表改用：

```bash
npx prisma db push
```

---

### ❌ Docker daemon not running（macOS）

**原因：** Docker Desktop 未啟動，或 macOS 上不想裝 Docker。

**解法：** 使用 Homebrew PostgreSQL：

```bash
brew install postgresql@16
brew services start postgresql@16
```

---

### ❌ App 無法連接資料庫（生產）

```bash
docker compose ps db
docker compose exec db pg_isready -U adviser
docker compose exec app env | grep DATABASE_URL
docker compose exec app npx prisma db pull
```

---

### ❌ Build 失敗（TypeScript 錯誤）

```bash
npx tsc --noEmit              # 顯示所有類型錯誤
npm run build 2>&1 | grep "error TS"
```

---

### ❌ AML Scheduler 未啟動

```bash
# 查看啟動訊息
docker compose logs app | grep -i scheduler
# 或本地：
cat /tmp/adviser-dev.log | grep Scheduler

# 應看到：
# [Scheduler] Scheduled daily job at 02:00 HKT (18:00 UTC)

# 若沒有，確認檔案存在：
ls src/instrumentation.ts
```

---

### ❌ Nginx 502 Bad Gateway

```bash
curl -I http://localhost:3000          # 確認 app 回應
docker compose ps app                  # Docker 狀態
pm2 status adviser                     # PM2 狀態
sudo tail -20 /var/log/nginx/error.log
```

---

### ❌ 記憶體不足 / OOMKilled

```bash
free -h       # 確認 swap 已啟用
docker stats  # 確認容器記憶體用量

# PM2：降低限制
# 編輯 ecosystem.config.js → max_memory_restart: '600M'
pm2 reload adviser
```

---

## 12. 快速參考卡

### 本地開發（macOS Homebrew）

```bash
brew services start postgresql@16   # 啟動 DB
npm run dev                          # 啟動 app → http://localhost:3000
npm run db:studio                    # DB GUI → http://localhost:5555
kill $(lsof -ti:3000)               # 停止 app
brew services stop postgresql@16    # 停止 DB
```

### 本地開發（Docker）

```bash
docker start adviser-db-dev   # 啟動 DB
npm run dev                    # 啟動 app
docker stop adviser-db-dev    # 停止 DB
```

### 生產環境

| 操作 | Docker Compose | PM2（裸機） |
|------|---------------|------------|
| 首次啟動 | `docker compose up -d --build` | `pm2 start ecosystem.config.js` |
| 更新部署 | `docker compose up -d --build` | `npm run build && pm2 reload adviser` |
| 重啟 app | `docker compose restart app` | `pm2 reload adviser` |
| 查看日誌 | `docker compose logs -f app` | `pm2 logs adviser` |
| 初始化資料庫 | `docker compose exec app npx prisma db push` | `npx prisma db push` |
| Seed | `docker compose exec app npx tsx prisma/seed.ts` | `npx tsx prisma/seed.ts` |
| 備份 DB | `docker compose exec -T db pg_dump -U adviser adviser_db \| gzip > backup.sql.gz` | `pg_dump -U adviser adviser_db \| gzip > backup.sql.gz` |
| 資源監控 | `docker stats` | `pm2 monit` |

---

*Last updated: 2026-04-22 — verified on macOS with Homebrew PostgreSQL 16*
