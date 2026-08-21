-- AlterEnum: AML alert disposition Reject (terminate / refuse — no EDD)
ALTER TYPE "AMLAlertResolution" ADD VALUE IF NOT EXISTS 'REJECTED';
