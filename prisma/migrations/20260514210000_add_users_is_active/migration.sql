-- User.isActive (added in Prisma schema after baseline init; auth + admin users depend on it)
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
