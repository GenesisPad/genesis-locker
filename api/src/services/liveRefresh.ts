import { AssetType } from "@prisma/client";
import { Interface, JsonRpcProvider } from "ethers";
import { chains, indexerBatchSize } from "../config.js";
import { genesisV3PositionLockerAbi } from "../contracts/genesisLockerAbi.js";
import { db } from "../db.js";
import { applyGenesisV3PositionLockerEvent } from "../indexer/reducer.js";
import { refreshV3PositionLockValue, syncContractMetadata } from "./metadata.js";

const v3Iface = new Interface(genesisV3PositionLockerAbi);
const REFRESH_THROTTLE_MS = 5_000;
const POSITION_VALUE_TTL_MS = 15_000;
const COLD_START_LOOKBACK_BLOCKS = 10_000n;

let v3RefreshPromise: Promise<void> | null = null;
let lastV3RefreshAt = 0;
const liveCursorByContract = new Map<string, number>();

async function catchUpV3LockerEvents() {
  for (const chain of chains) {
    if (!chain.rpcUrl || !chain.v3PositionLockerAddress) continue;

    const contractAddress = chain.v3PositionLockerAddress.toLowerCase();
    const provider = new JsonRpcProvider(chain.rpcUrl);
    const latest = await provider.getBlockNumber();
    const cursor = await db.indexCursor.findUnique({
      where: { chainId_contractAddress: { chainId: chain.id, contractAddress } }
    });

    await syncContractMetadata(chain.id, contractAddress, provider).catch(() => undefined);

    const fallbackStart = BigInt(Math.max(0, latest)) > COLD_START_LOOKBACK_BLOCKS
      ? BigInt(latest) - COLD_START_LOOKBACK_BLOCKS
      : 0n;
    const cursorStart = cursor?.lastBlock !== undefined ? cursor.lastBlock + 1n : fallbackStart;
    const liveCursorKey = `${chain.id}:${contractAddress}`;
    const liveCursorStart = BigInt(liveCursorByContract.get(liveCursorKey) ?? 0) + 1n;
    let fromBlock = Number(cursorStart > liveCursorStart ? cursorStart : liveCursorStart);
    fromBlock = Math.max(fromBlock, Number(fallbackStart));
    if (fromBlock > latest) continue;

    while (fromBlock <= latest) {
      const toBlock = Math.min(fromBlock + indexerBatchSize - 1, latest);
      const logs = await provider.getLogs({ address: contractAddress, fromBlock, toBlock });

      for (const log of logs) {
        const parsed = v3Iface.parseLog(log);
        if (parsed) {
          await applyGenesisV3PositionLockerEvent(db, chain.id, contractAddress, log, parsed, provider);
        }
      }

      liveCursorByContract.set(liveCursorKey, toBlock);
      fromBlock = toBlock + 1;
    }
  }
}

export async function refreshLiveV3LockerData(force = false) {
  const now = Date.now();
  if (!force && now - lastV3RefreshAt < REFRESH_THROTTLE_MS) return;
  if (v3RefreshPromise) return v3RefreshPromise;

  v3RefreshPromise = catchUpV3LockerEvents()
    .catch((error) => {
      console.warn("Live V3 locker refresh failed", error);
    })
    .finally(() => {
      lastV3RefreshAt = Date.now();
      v3RefreshPromise = null;
    });

  return v3RefreshPromise;
}

export async function refreshV3PositionValues(lockIds?: string[]) {
  const where = lockIds?.length
    ? { id: { in: lockIds } }
    : { assetType: AssetType.V3_POSITION };
  const staleCutoff = new Date(Date.now() - POSITION_VALUE_TTL_MS);
  const locks = await db.lock.findMany({
    where: {
      ...where,
      updatedAt: { lt: staleCutoff }
    },
    select: { id: true },
    take: lockIds?.length ? undefined : 25
  });

  await Promise.all(locks.map((lock) => refreshV3PositionLockValue(lock.id)));
}
