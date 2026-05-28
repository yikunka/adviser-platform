import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Parent dirs may contain another `package-lock.json`; lock Turbopack to this app. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

// When OSS_CDN_URL is set at build time, Next.js loads _next/static/ chunks
// from the CDN instead of the app server. Run scripts/sync-oss-static.mjs
// after `next build` to upload the chunks before the server starts.
const cdnUrl = process.env.OSS_CDN_URL?.trim().replace(/\/$/, '') || undefined

// Parse the CDN hostname for remotePatterns (needed for <Image> with OSS URLs)
let ossHostname: string | undefined
try {
  if (cdnUrl) ossHostname = new URL(cdnUrl).hostname
} catch { /* invalid URL — skip */ }

const nodeBuiltinBrowserStub = "./src/lib/node-empty-module.ts";

/** pg (via Prisma adapter) uses Node built-ins; stub them in client bundles when unavoidable. */
const nodeBuiltinClientFallbacks = ["dns", "net", "tls"] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  assetPrefix: cdnUrl,
  turbopack: {
    root: turbopackRoot,
    resolveAlias: Object.fromEntries(
      nodeBuiltinClientFallbacks.map((name) => [
        name,
        { browser: nodeBuiltinBrowserStub },
      ]),
    ),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...Object.fromEntries(
          nodeBuiltinClientFallbacks.map((name) => [name, false]),
        ),
      };
    }
    return config;
  },
  serverExternalPackages: ["node-cron", "@prisma/client", "@prisma/adapter-pg", "pg", "pdfjs-dist"],
  images: {
    // Route all <Image> requests through OSS Image Processing when CDN is set.
    // The loader appends ?x-oss-process=image/resize,w_<w>/format,webp/quality,q_<q>
    loaderFile: "./src/lib/oss-loader.ts",
    // Allow <Image> to load from the OSS/CDN domain
    remotePatterns: ossHostname
      ? [{ protocol: "https", hostname: ossHostname }]
      : [],
    // Keep built-in sizes reasonable — OSS will serve exactly the width requested
    deviceSizes: [640, 828, 1080, 1280, 1920],
    imageSizes: [64, 128, 256, 384, 512],
  },
};

export default withNextIntl(nextConfig);
