-- CreateEnum
CREATE TYPE "SfsDiamondSpecCategory" AS ENUM (
  'COLOR',
  'CARAT',
  'SHAPE',
  'SETTING_TYPE',
  'RING_DESIGN',
  'NECKLACE_DESIGN',
  'METAL'
);

-- CreateTable
CREATE TABLE "sfs_diamond_spec_options" (
  "id" TEXT NOT NULL,
  "category" "SfsDiamondSpecCategory" NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sfs_diamond_spec_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sfs_diamond_spec_options_category_value_key"
  ON "sfs_diamond_spec_options"("category", "value");

-- CreateIndex
CREATE INDEX "sfs_diamond_spec_options_category_sortOrder_idx"
  ON "sfs_diamond_spec_options"("category", "sortOrder");

-- Seed current order-form options.
INSERT INTO "sfs_diamond_spec_options"
  ("id", "category", "label", "value", "imageUrl", "sortOrder", "isActive")
VALUES
  ('sfs-spec-color-natural', 'COLOR', 'Natural Color', 'Natural Color', NULL, 10, true),
  ('sfs-spec-color-transparent', 'COLOR', 'Transparent', 'Transparent', NULL, 20, true),

  ('sfs-spec-carat-050', 'CARAT', '0.5', '0.5', NULL, 10, true),
  ('sfs-spec-carat-100', 'CARAT', '1.0', '1.0', NULL, 20, true),
  ('sfs-spec-carat-150', 'CARAT', '1.5', '1.5', NULL, 30, true),
  ('sfs-spec-carat-200', 'CARAT', '2.0', '2.0', NULL, 40, true),
  ('sfs-spec-carat-250', 'CARAT', '2.5', '2.5', NULL, 50, true),
  ('sfs-spec-carat-300', 'CARAT', '3.0', '3.0', NULL, 60, true),

  ('sfs-spec-shape-round', 'SHAPE', 'Round', 'Round', '/sfsdiamond/order/cut-round.jpeg', 10, true),
  ('sfs-spec-shape-oval', 'SHAPE', 'Oval', 'Oval', '/sfsdiamond/order/cut-oval.jpeg', 20, true),
  ('sfs-spec-shape-heart', 'SHAPE', 'Heart', 'Heart', '/sfsdiamond/order/cut-heart.jpeg', 30, true),
  ('sfs-spec-shape-octagon', 'SHAPE', 'Octagon', 'Octagon', '/sfsdiamond/order/cut-octagon.jpeg', 40, true),
  ('sfs-spec-shape-cushion-square', 'SHAPE', 'Cushion Square', 'Cushion Square', '/sfsdiamond/order/cut-cushion.jpeg', 50, true),
  ('sfs-spec-shape-princess', 'SHAPE', 'Princess', 'Princess', '/sfsdiamond/order/cut-princess.png', 60, true),
  ('sfs-spec-shape-emerald', 'SHAPE', 'Emerald', 'Emerald', '/sfsdiamond/order/cut-Emerald.png', 70, true),

  ('sfs-spec-setting-ring', 'SETTING_TYPE', 'Ring', 'Ring', NULL, 10, true),
  ('sfs-spec-setting-necklace', 'SETTING_TYPE', 'Necklace', 'Necklace', NULL, 20, true),
  ('sfs-spec-setting-diamond-only', 'SETTING_TYPE', 'Diamond only', 'Diamond only', NULL, 30, true),

  ('sfs-spec-ring-solitaire', 'RING_DESIGN', 'Solitaire', 'Solitaire', '/sfsdiamond/order/ring-solitaire.png', 10, true),
  ('sfs-spec-ring-pave', 'RING_DESIGN', 'Pave', 'Pave', '/sfsdiamond/order/ring-pave.png', 20, true),
  ('sfs-spec-ring-halo', 'RING_DESIGN', 'Halo', 'Halo', '/sfsdiamond/order/ring-halo.png', 30, true),
  ('sfs-spec-ring-r-classic', 'RING_DESIGN', 'R Classic', 'R Classic', '/sfsdiamond/order/ring-R-Classic.jpg', 40, true),

  ('sfs-spec-necklace-classic', 'NECKLACE_DESIGN', 'Classic', 'Classic', '/sfsdiamond/order/necklace-classic.jpeg', 10, true),
  ('sfs-spec-necklace-plain', 'NECKLACE_DESIGN', 'Plain', 'Plain', '/sfsdiamond/order/necklace-plain.jpeg', 20, true),
  ('sfs-spec-necklace-buddha', 'NECKLACE_DESIGN', 'Buddha', 'Buddha', '/sfsdiamond/order/necklace-buddha.jpeg', 30, true),
  ('sfs-spec-necklace-cross', 'NECKLACE_DESIGN', 'Cross', 'Cross', '/sfsdiamond/order/necklace-cross.jpeg', 40, true),
  ('sfs-spec-necklace-yinyang', 'NECKLACE_DESIGN', 'Yinyang', 'Yinyang', '/sfsdiamond/order/necklace-yinyang.jpeg', 50, true),

  ('sfs-spec-metal-platinum', 'METAL', 'Platinum', 'Platinum', NULL, 10, true),
  ('sfs-spec-metal-yellow-gold', 'METAL', 'Yellow Gold', 'Yellow Gold', NULL, 20, true),
  ('sfs-spec-metal-rose-gold', 'METAL', 'Rose Gold', 'Rose Gold', NULL, 30, true),
  ('sfs-spec-metal-white-gold', 'METAL', 'White Gold', 'White Gold', NULL, 40, true);
