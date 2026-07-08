import { JsonRpcProvider } from "ethers";
import { chains } from "../config.js";
import { db } from "../db.js";
import { refreshAssetPrice, refreshAssetCalculations } from "../services/metadata.js";
import { isRpcReachable } from "./rpc.js";

/**
 * Re-prices every already-indexed asset on a timer (see the cron entry in
 * deploy-contabo.yml) so USD values track the live market instead of being
 * frozen at whatever price happened to be current when a lock was created.
 * Deliberately skips the identity/bytecode re-scan that syncAssetMetadata
 * does (name, symbol, decimals, mint/tax/blacklist) - those don't change,
 * so a frequent job should only pay for what actually goes stale: price.
 */
async function refreshPrices() {
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
    await refreshAssetPrice(asset.chainId, asset.assetAddress, asset.assetType, provider);
    await refreshAssetCalculations(asset.chainId, asset.assetAddress);
  }
}

await refreshPrices();
await db.$disconnect();
