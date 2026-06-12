-- AlterEnum
ALTER TYPE "SfsDiamondSpecCategory" ADD VALUE 'EARRING_DESIGN';
ALTER TYPE "SfsDiamondSpecCategory" ADD VALUE 'BRACELET_DESIGN';

-- New setting types and design options for earring / bracelet jewellery.
INSERT INTO "sfs_diamond_spec_options"
  ("id", "category", "label", "value", "imageUrl", "sortOrder", "isActive")
VALUES
  ('sfs-spec-setting-earring', 'SETTING_TYPE', 'Earring', 'Earring', NULL, 25, true),
  ('sfs-spec-setting-bracelet', 'SETTING_TYPE', 'Bracelet', 'Bracelet', NULL, 30, true),

  ('sfs-spec-earring-stud', 'EARRING_DESIGN', 'Stud', 'Stud', NULL, 10, true),
  ('sfs-spec-earring-drop', 'EARRING_DESIGN', 'Drop', 'Drop', NULL, 20, true),
  ('sfs-spec-earring-hoop', 'EARRING_DESIGN', 'Hoop', 'Hoop', NULL, 30, true),

  ('sfs-spec-bracelet-classic', 'BRACELET_DESIGN', 'Classic', 'Classic', '/sfsdiamond/order/necklace-classic.jpeg', 10, true),
  ('sfs-spec-bracelet-plain', 'BRACELET_DESIGN', 'Plain', 'Plain', '/sfsdiamond/order/necklace-plain.jpeg', 20, true),
  ('sfs-spec-bracelet-tennis', 'BRACELET_DESIGN', 'Tennis', 'Tennis', NULL, 30, true),
  ('sfs-spec-bracelet-chain', 'BRACELET_DESIGN', 'Chain', 'Chain', NULL, 40, true)
ON CONFLICT ("category", "value") DO NOTHING;

-- Keep Diamond only after the new setting types.
UPDATE "sfs_diamond_spec_options"
SET "sortOrder" = 40
WHERE "category" = 'SETTING_TYPE' AND "value" = 'Diamond only' AND "sortOrder" < 40;
