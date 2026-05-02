import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 无 dotenv 依赖：开发时从 .env / .env.local 注入；生产 migrate 依赖 shell 已 source 的变量。 */
function loadEnvFromFiles() {
  const parse = (text) => {
    /** @type {Record<string, string>} */
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  };

  /** @type {Record<string, string>} */
  let merged = {};
  for (const name of [".env", ".env.local"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    merged = { ...merged, ...parse(readFileSync(p, "utf8")) };
  }
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFromFiles();

/** 延迟读取，避免 CLI 子进程过早固定空 URL 导致退回「库名=用户名」的 adviser 库。 */
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  get datasource() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL 未设置：请在环境中配置，或在项目根目录提供可读写的 .env。",
      );
    }
    return { url };
  },
};
