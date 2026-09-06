# Work Status

## 2026-09-06 SFS 自訂設計稿 OSS 上傳加固

- 需求：沿用既有規則，匿名客戶可即時上傳並匿名讀取 SFS 自訂設計稿；復用現有 `OSS_BUCKET`，不新增 Bucket 或環境變數；未提交文件保留 7 天。
- 簡版 SDD：瀏覽器僅提交不透明 `uploadId`；服務端保存 OSS key 和暫存歸屬。訂單建立或編輯時在交易內認領暫存上傳並建立附件，前端移除暫存附件立即刪除物件；每日工作排程重試清理過期未認領物件。附件 ID 與舊有 storage key 下載均保留匿名讀取。
- 已實作：基於既有 OSS 儲存適配的暫存上傳資料模型和 migration、草稿 Cookie 歸屬、上傳限流、附件 ID 下載入口、驗證後自動認領同郵箱匿名訂單，以及到期清理排程。
- 部署邊界：沿用既有 OSS 區域、Bucket 與 RAM 憑證；不需建立或配置額外 Bucket。
- 實際驗證：本地 Docker PostgreSQL 已套用 migration；Vitest 7 項通過、`npx tsc --noEmit` 與 `npx prisma validate` 通過、受影響模組 ESLint 無錯誤。以 `USE_LOCAL_STORAGE=true` 啟動隔離開發服務，完成匿名 PDF 上傳、草稿 Cookie 認領後建立訂單、前端移除暫存文件，以及桌面和 390px 手機視口截圖；未登入下載 `designAttachmentId` 與既有 `?key=` 連結均回傳 200 並取得原始檔案。測試訂單、附件與臨時文件已清理。

## 2026-09-06 GitHub 最新版本生产发布

- 需求：拉取 GitHub `yikunka/adviser-platform` 的 `main` 最新版本，并发布到现有生产环境。
- 阶段：已发布，生产验收通过。
- 初始状态：本地 `main`，提交 `5b1523c`，工作区干净。
- 简版 SDD：使用现有部署流程；先核对远程与本地差异，再 fast-forward 拉取；确认生产当前版本、运行目录和回退备份；按实际差异运行最小验证及发布所需构建；部署后核对版本、进程、HTTP 与错误日志。
- 验收：本地 HEAD 对齐 GitHub main；生产版本对齐目标提交；服务及公开入口正常。
- 验证边界：本任务为版本同步与发布，不新增功能；不默认执行全仓测试、全量 lint 或 E2E。发布构建按部署需要执行；如需扩大验证，先说明并确认。
- 回退：生产写入前保留当前部署产物和版本记录；如涉及迁移，先审查迁移并备份数据库。
- 已完成：通过 HTTPS 拉取并 fast-forward 到 GitHub `main` 的 `79de5e6`；确认生产为 `cosmo-prod:/opt/adviser-app`，运行版本 `089a8ac`、`adviser` PM2 在线、Nginx 检查通过；核对生产 Prisma 已应用现有 136 个迁移；受影响测试 59 项通过。
- 发布阻断与修复：最新版本订单向导将客户端组件引入了带 R2/Node 文件系统依赖的上传模块，Next 构建报 `Can't resolve fs/promises`。已将共享校验与类型移至无服务器依赖的模块，保留上传路由在服务端，并新增 2 项回归测试。类型检查通过，相关 ESLint 无错误（3 条为原有警告）。
- 构建：源码编译与 TypeScript 检查通过；完整静态生成在本机因占位数据库账号无访问权于 `/sfsdiamond/order` 失败。生产数据库仅由服务器环境变量配置，不将凭据取回本机；待确认服务器侧可构建路径后验证。
- 发布结果：为修复构建阻断新增提交 `8cefc4149ca3082bf0502848d2744f7a10fceddf` 并成功推送至 GitHub `main`。生产在独立目录从该提交克隆、安装依赖并完成 99 个页面的完整构建，`BUILD_ID=3PRLdPhAcI6JK9axbltSQ`。
- 数据安全：部署前数据库备份已上传至 `oss://advise-mainland/backups/db/adviser_backup_20260906_174557.sql.gz`，保留策略检查通过（5/10）。生产应用了唯一待执行迁移 `20260906143042_sfs_custom_design_quote`，随后迁移状态为 137 项全部一致。
- 生产验收：产物 BUILD_ID 与目标一致；`.adviser-deploy-rev` 为 `8cefc4149ca3082bf0502848d2744f7a10fceddf`；PM2 `adviser` 在线，启动日志显示 Next.js Ready；Nginx 检查通过；SFS HTTP 和 HTTPS 跟随重定向后均返回 200。
- 前端体验验收限制：尝试隔离浏览器截图时，Mac 处于锁屏状态；无头浏览器到公网域名的连接被本机网络关闭，SSH 回环隧道也被服务器重置，故未获得可用的浏览器截图。未将这些失败截图作为验收证据。
- 待完成：无发布动作；如需补充视觉截图，解锁本机后对 `https://sfsdiamonds.com/sfsdiamond/order` 重新执行桌面与移动视口检查。
