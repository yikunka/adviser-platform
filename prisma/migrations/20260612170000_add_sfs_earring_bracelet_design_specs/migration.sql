-- AlterEnum
ALTER TYPE "SfsDiamondSpecCategory" ADD VALUE IF NOT EXISTS 'EARRING_DESIGN';
ALTER TYPE "SfsDiamondSpecCategory" ADD VALUE IF NOT EXISTS 'BRACELET_DESIGN';

-- New setting types and design options for earring / bracelet jewellery.
INSERT INTO "sfs_diamond_spec_options"
  ("id", "category", "label", "value", "imageUrl", "sortOrder", "isActive", "updatedAt")
VALUES
  ('sfs-spec-setting-earring', 'SETTING_TYPE', 'Earring', 'Earring', NULL, 25, true, CURRENT_TIMESTAMP),
  ('sfs-spec-setting-bracelet', 'SETTING_TYPE', 'Bracelet', 'Bracelet', NULL, 30, true, CURRENT_TIMESTAMP),

  ('sfs-spec-earring-stud', 'EARRING_DESIGN', 'Stud', 'Stud', NULL, 10, true, CURRENT_TIMESTAMP),
  ('sfs-spec-earring-drop', 'EARRING_DESIGN', 'Drop', 'Drop', NULL, 20, true, CURRENT_TIMESTAMP),
  ('sfs-spec-earring-hoop', 'EARRING_DESIGN', 'Hoop', 'Hoop', NULL, 30, true, CURRENT_TIMESTAMP),

  ('sfs-spec-bracelet-classic', 'BRACELET_DESIGN', 'Classic', 'Classic', '/sfsdiamond/order/necklace-classic.jpeg', 10, true, CURRENT_TIMESTAMP),
  ('sfs-spec-bracelet-plain', 'BRACELET_DESIGN', 'Plain', 'Plain', '/sfsdiamond/order/necklace-plain.jpeg', 20, true, CURRENT_TIMESTAMP),
  ('sfs-spec-bracelet-tennis', 'BRACELET_DESIGN', 'Tennis', 'Tennis', NULL, 30, true, CURRENT_TIMESTAMP),
  ('sfs-spec-bracelet-chain', 'BRACELET_DESIGN', 'Chain', 'Chain', NULL, 40, true, CURRENT_TIMESTAMP)
ON CONFLICT ("category", "value") DO NOTHING;

-- Keep Diamond only after the new setting types.
UPDATE "sfs_diamond_spec_options"
SET "sortOrder" = 40
WHERE "category" = 'SETTING_TYPE' AND "value" = 'Diamond only' AND "sortOrder" < 40;
