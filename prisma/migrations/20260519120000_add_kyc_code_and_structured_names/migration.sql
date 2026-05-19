ALTER TABLE "key_persons"
ADD COLUMN "kyc_code" TEXT,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "otherName" TEXT;

CREATE UNIQUE INDEX "key_persons_kyc_code_key" ON "key_persons"("kyc_code");
