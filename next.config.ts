import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Parent dirs may contain another `package-lock.json`; lock Turbopack to this app. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: turbopackRoot,
  },
  // Turbopack + instrumentation: do not bundle these (avoids bogus `*-hash` externals and broken Prisma resolution).
  serverExternalPackages: ["node-cron", "@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default withNextIntl(nextConfig);
