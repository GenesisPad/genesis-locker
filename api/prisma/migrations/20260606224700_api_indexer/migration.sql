CREATE TYPE "AssetType" AS ENUM ('TOKEN', 'LP');
CREATE TYPE "LockType" AS ENUM ('CLIFF', 'VESTING', 'PERMANENT');

CREATE TABLE "Chain" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "rpcEnvKey" TEXT NOT NULL,
  "explorerUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contract" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "isRenounced" BOOLEAN NOT NULL DEFAULT false,
  "creationFee" TEXT,
  "ownerAddress" TEXT,
  "deployedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Token" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "name" TEXT,
  "symbol" TEXT,
  "decimals" INTEGER,
  "totalSupply" TEXT,
  "priceUsd" DECIMAL(30,12),
  "hasMintRisk" BOOLEAN NOT NULL DEFAULT false,
  "hasHighTaxRisk" BOOLEAN NOT NULL DEFAULT false,
  "hasBlacklistRisk" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pair" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "token0" TEXT,
  "token1" TEXT,
  "dex" TEXT,
  "totalSupply" TEXT,
  "reserveUsd" DECIMAL(30,8),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lock" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "lockId" BIGINT NOT NULL,
  "contractAddress" TEXT NOT NULL,
  "assetAddress" TEXT NOT NULL,
  "assetType" "AssetType" NOT NULL,
  "lockType" "LockType" NOT NULL,
  "ownerAddress" TEXT NOT NULL,
  "beneficiaryAddress" TEXT NOT NULL,
  "amount" TEXT NOT NULL,
  "withdrawnAmount" TEXT NOT NULL DEFAULT '0',
  "startTime" TIMESTAMP(3) NOT NULL,
  "cliffTime" TIMESTAMP(3),
  "endTime" TIMESTAMP(3),
  "vestingInterval" INTEGER,
  "isPermanent" BOOLEAN NOT NULL DEFAULT false,
  "metadataURI" TEXT,
  "tvlUsd" DECIMAL(30,8),
  "lockedPercentage" DECIMAL(8,3),
  "createdTxHash" TEXT,
  "createdBlockNumber" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LockEvent" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "lockDbId" TEXT,
  "lockId" BIGINT,
  "eventName" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "blockNumber" BIGINT NOT NULL,
  "logIndex" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LockEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndexCursor" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "contractAddress" TEXT NOT NULL,
  "lastBlock" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndexCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyStat" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "totalLocks" INTEGER NOT NULL,
  "totalActiveLocks" INTEGER NOT NULL,
  "totalPermanentLocks" INTEGER NOT NULL,
  "tvlUsd" DECIMAL(30,8) NOT NULL,
  "lpTvlUsd" DECIMAL(30,8) NOT NULL,
  "tokenTvlUsd" DECIMAL(30,8) NOT NULL,
  CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeStat" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" TEXT NOT NULL,
  "amountUsd" DECIMAL(30,8),
  CONSTRAINT "FeeStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_chainId_address_key" ON "Contract"("chainId", "address");
CREATE UNIQUE INDEX "Token_chainId_address_key" ON "Token"("chainId", "address");
CREATE UNIQUE INDEX "Pair_chainId_address_key" ON "Pair"("chainId", "address");
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");
CREATE UNIQUE INDEX "Lock_chainId_lockId_key" ON "Lock"("chainId", "lockId");
CREATE INDEX "Lock_chainId_assetAddress_idx" ON "Lock"("chainId", "assetAddress");
CREATE INDEX "Lock_chainId_ownerAddress_idx" ON "Lock"("chainId", "ownerAddress");
CREATE UNIQUE INDEX "LockEvent_chainId_txHash_logIndex_key" ON "LockEvent"("chainId", "txHash", "logIndex");
CREATE INDEX "LockEvent_chainId_lockId_idx" ON "LockEvent"("chainId", "lockId");
CREATE UNIQUE INDEX "IndexCursor_chainId_contractAddress_key" ON "IndexCursor"("chainId", "contractAddress");
CREATE UNIQUE INDEX "DailyStat_chainId_date_key" ON "DailyStat"("chainId", "date");
CREATE UNIQUE INDEX "FeeStat_chainId_date_key" ON "FeeStat"("chainId", "date");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Token" ADD CONSTRAINT "Token_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_chainId_assetAddress_fkey" FOREIGN KEY ("chainId", "assetAddress") REFERENCES "Token"("chainId", "address") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_ownerAddress_fkey" FOREIGN KEY ("ownerAddress") REFERENCES "Wallet"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LockEvent" ADD CONSTRAINT "LockEvent_lockDbId_fkey" FOREIGN KEY ("lockDbId") REFERENCES "Lock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndexCursor" ADD CONSTRAINT "IndexCursor_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStat" ADD CONSTRAINT "FeeStat_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
