ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'V3_POSITION';

ALTER TABLE "Lock"
ADD COLUMN IF NOT EXISTS "positionManager" TEXT,
ADD COLUMN IF NOT EXISTS "positionTokenId" TEXT,
ADD COLUMN IF NOT EXISTS "launchTokenAddress" TEXT,
ADD COLUMN IF NOT EXISTS "pairedAssetAddress" TEXT,
ADD COLUMN IF NOT EXISTS "poolAddress" TEXT,
ADD COLUMN IF NOT EXISTS "initialLiquidity" TEXT;

DROP INDEX IF EXISTS "Lock_chainId_lockId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Lock_chainId_contractAddress_lockId_key" ON "Lock"("chainId", "contractAddress", "lockId");
CREATE INDEX IF NOT EXISTS "Lock_chainId_positionManager_positionTokenId_idx" ON "Lock"("chainId", "positionManager", "positionTokenId");
