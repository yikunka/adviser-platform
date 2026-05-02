import { createRequire } from "node:module";
import { defineConfig } from "prisma/config";

// 开发仓库内有 dotenv；生产仅同步 standalone 的目录（如 /opt/adviser-app）没有 node_modules，
// migrate 前由 shell `source .env` 注入 DATABASE_URL，此处跳过即可。
const require = createRequire(import.meta.url);
try {
  require.resolve("dotenv");
  require("dotenv/config");
} catch {
  /* 无 dotenv 包时依赖进程环境变量 */
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
