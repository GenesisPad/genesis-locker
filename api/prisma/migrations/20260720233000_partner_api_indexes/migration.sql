CREATE INDEX "Lock_chainId_poolAddress_idx" ON "Lock"("chainId", "poolAddress");
CREATE INDEX "Lock_chainId_assetType_createdAt_idx" ON "Lock"("chainId", "assetType", "createdAt");
CREATE INDEX "LockEvent_chainId_blockNumber_logIndex_idx" ON "LockEvent"("chainId", "blockNumber", "logIndex");
