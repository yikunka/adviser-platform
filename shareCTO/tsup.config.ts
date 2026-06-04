import { defineConfig } from 'tsup'

export default defineConfig([
  // ── Public API: types only ────────────────────────────────────────────────
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    external: ['react', 'react-dom', 'next'],
  },
  // ── Widget: React client component ───────────────────────────────────────
  {
    entry: { 'widget/index': 'src/widget/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom', 'next', 'next/navigation'],
    esbuildOptions(opts) {
      opts.jsx = 'automatic'
    },
  },
  // ── Routes: server-side handler factories ────────────────────────────────
  {
    entry: { 'routes/index': 'src/routes/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom', 'next', 'next/server'],
  },
  // ── CLI ───────────────────────────────────────────────────────────────────
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['cjs'],
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
    external: [],
  },
])
