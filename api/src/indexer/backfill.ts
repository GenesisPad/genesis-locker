import { JsonRpcProvider } from "ethers";
import { chains } from "../config.js";
import { db } from "../db.js";
import { syncAssetMetadata, refreshAssetCalculations, refreshV3PositionLockValue } from "../services/metadata.js";
import { isRpcReachable } from "./rpc.js";

/**
 * Re-syncs token/pair metadata and re-derives lockedPercentage/tvlUsd for
 * every already-indexed asset. Run this once after a metadata/calculation
 * bugfix lands, so existing DB rows written by the old buggy code get
 * corrected instead of only new locks benefiting from the fix.
 */
async function backfill() {
  const distinctAssets = await db.lock.findMany({
    select: { chainId: true, assetAddress: true, assetType: true },
    distinct: ["chainId", "assetAddress"]
  });

  for (const asset of distinctAssets) {
    const chain = chains.find((c) => c.id === asset.chainId);
    if (!chain?.rpcUrl) continue;
    if (!(await isRpcReachable(chain.rpcUrl))) {
      console.warn(`Skipping ${chain.name} (${asset.assetAddress}): RPC unreachable`);
      continue;
    }
    const provider = new JsonRpcProvider(chain.rpcUrl);
    await syncAssetMetadata(asset.chainId, asset.assetAddress, asset.assetType, provider);
    await refreshAssetCalculations(asset.chainId, asset.assetAddress);
    console.log(`Backfilled ${chain.name} ${asset.assetAddress}`);
  }

  const positionLocks = await db.lock.findMany({
    where: { assetType: "V3_POSITION" },
    select: { id: true }
  });
  for (const lock of positionLocks) {
    await refreshV3PositionLockValue(lock.id);
    console.log(`Refreshed locked position ${lock.id}`);
  }
}

await backfill();
await db.$disconnect();
