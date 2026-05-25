# Hermes Agent Memory

This repository is one Next.js 16 + Prisma/PostgreSQL monorepo that hosts three business platforms with shared auth, admin access control, document upload/storage, and deployment infrastructure.

## 1. Adviser Platform

Core corporate services platform under locale routes `src/app/[locale]/...`. It manages client companies, KYC, AML screening, company statutory records, document generation, annual return/NAR1, DDR reports, and client/admin dashboards. Key admin areas are companies, KYC queue, AML, users, team, settings. Main database models include `Company`, `User`, `KeyPerson`, company registers, `Document`, file cases, AML records/checks/alerts, and generated filings.

## 2. SFS Diamond

Standalone business site and order system under `src/app/sfsdiamond/`, served without locale prefix. It is for memorial diamond / CVD diamond services, with public marketing pages, auth, customer dashboard, order wizard, and admin order management. Database tables use the `sfs_` prefix; admin permission key is `sfsOrders`.

## 3. CosmoCoat

Standalone industrial coatings business under `src/app/cosmocoat/`, also served without locale prefix. It has public brand/product/support pages plus admin modules for products, raw materials, recipes, factory products, and production orders. Database tables use the `cos_` prefix; admin permission keys are `cosmocoatProducts`, `cosmocoatRawMaterials`, `cosmocoatRecipes`, `cosmocoatFactoryProducts`, and `cosmocoatProductionOrders`.

## Operating Notes

Follow `AGENTS.md`: this project uses a newer Next.js with changed conventions, so read relevant docs in `node_modules/next/dist/docs/` before coding Next-specific behavior. Keep platform-specific code inside each platform folder, shared business logic in `src/lib`, shared UI in `src/components`, and preserve existing RBAC/menu patterns in `src/lib/auth/admin-access.ts`.
