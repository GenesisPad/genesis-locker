import { AssetType, Lock, LockType } from "@prisma/client";
import { db } from "../db.js";
import { chains, lowLockPercentageThreshold, shortLockDays } from "../config.js";

export type LockListFilters = {
  limit?: number;
  assetType?: "token" | "lp" | "v3_position";
  lockType?: "timed" | "vesting" | "permanent";
  unlockingSoon?: boolean;
};

type LockWithRelations = Lock & {
  token: {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    totalSupply: string | null;
    hasMintRisk: boolean;
    hasHighTaxRisk: boolean;
    hasBlacklistRisk: boolean;
  } | null;
  events: Array<{
    eventName: string;
    txHash: string;
    blockNumber: bigint;
    logIndex: number;
    payload: unknown;
    createdAt: Date;
  }>;
};

function dateToIso(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function txUrl(explorerUrl: string | null | undefined, txHash: string) {
  return explorerUrl ? `${explorerUrl}/tx/${txHash}` : null;
}

function remainingAmount(lock: Pick<Lock, "amount" | "withdrawnAmount">) {
  return BigInt(lock.amount) - BigInt(lock.withdrawnAmount);
}

function wrappedNativeAddress(chainId: number) {
  return chains.find((chain) => chain.id === chainId)?.wrappedNativeAddress?.toLowerCase() ?? null;
}

function wrappedNativeLockKey(lock: Pick<Lock, "chainId" | "assetAddress" | "assetType">) {
  const nativeAddress = wrappedNativeAddress(lock.chainId);
  if (lock.assetType !== AssetType.TOKEN || !nativeAddress || lock.assetAddress.toLowerCase() !== nativeAddress) return null;
  return `${lock.chainId}:${nativeAddress}`;
}

async function filterDisplayLocks<T extends Pick<Lock, "chainId" | "assetAddress" | "assetType">>(locks: T[]): Promise<T[]> {
  const candidateKeys = [...new Set(locks.map(wrappedNativeLockKey).filter((key): key is string => Boolean(key)))];
  if (candidateKeys.length === 0) return locks;

  const duplicatePairs = await db.lock.findMany({
    where: {
      assetType: AssetType.V3_POSITION,
      OR: candidateKeys.map((key) => {
        const [chainId, address] = key.split(":");
        return { chainId: Number(chainId), pairedAssetAddress: address };
      })
    },
    select: { chainId: true, pairedAssetAddress: true }
  });
  const duplicateKeys = new Set(duplicatePairs.map((lock) => `${lock.chainId}:${lock.pairedAssetAddress?.toLowerCase()}`));

  return locks.filter((lock) => {
    const key = wrappedNativeLockKey(lock);
    return !key || !duplicateKeys.has(key);
  });
}

function claimableAmount(lock: Pick<Lock, "amount" | "withdrawnAmount" | "isPermanent" | "lockType" | "cliffTime" | "endTime" | "startTime" | "vestingInterval">, now = new Date()) {
  if (lock.isPermanent || (lock.cliffTime && now < lock.cliffTime)) return 0n;
  const remaining = remainingAmount(lock);
  if (lock.lockType !== LockType.VESTING || !lock.endTime || !lock.vestingInterval) return remaining;
  if (now >= lock.endTime) return remaining;

  const elapsed = BigInt(Math.max(0, Math.floor((now.getTime() - lock.startTime.getTime()) / 1000)));
  const duration = BigInt(Math.max(1, Math.floor((lock.endTime.getTime() - lock.startTime.getTime()) / 1000)));
  const interval = BigInt(lock.vestingInterval);
  const vestedSeconds = (elapsed / interval) * interval;
  const vestedAmount = (BigInt(lock.amount) * vestedSeconds) / duration;
  const withdrawn = BigInt(lock.withdrawnAmount);
  return vestedAmount > withdrawn ? vestedAmount - withdrawn : 0n;
}

// totalAssetLockedPercentage is the SUM of every lock's own share of supply
// for this asset (not this one lock's share alone) - "is enough of the
// supply locked" is a question about the asset as a whole, not about how
// this particular lock's slice compares to the threshold on its own.
function buildWarnings(lock: LockWithRelations, totalAssetLockedPercentage: number | undefined) {
  const warnings: string[] = [];
  if (lock.assetType === AssetType.V3_POSITION) return warnings;
  if (lock.endTime && lock.createdAt) {
    const durationDays = (lock.endTime.getTime() - lock.startTime.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays < shortLockDays) warnings.push("Short Lock");
  }
  if (totalAssetLockedPercentage !== undefined && totalAssetLockedPercentage < lowLockPercentageThreshold) warnings.push("Low Lock Percentage");
  if (lock.token?.hasMintRisk) warnings.push("Mint Risk");
  if (lock.token?.hasHighTaxRisk) warnings.push("High Tax Risk");
  if (lock.token?.hasBlacklistRisk) warnings.push("Blacklist Risk");
  return warnings;
}

function badgesFor(lock: LockWithRelations) {
  if (lock.assetType === AssetType.V3_POSITION) {
    return ["Liquidity Position Locked", "Genesis Launch", "Permanently Locked"];
  }
  const badges = [lock.assetType === AssetType.LP ? "LP Locked" : "Token Locked"];
  badges.push(lock.lockType === LockType.VESTING ? "Vesting Lock" : "Cliff Lock");
  if (lock.isPermanent) badges.push("Permanently Locked");
  return badges;
}

function serializeLock(lock: LockWithRelations, explorerUrl?: string | null) {
  const claimable = claimableAmount(lock);
  const feeEvents = lock.events.filter((event) => event.eventName === "FeesCollected");
  return {
    lockId: lock.lockId.toString(),
    chainId: lock.chainId,
    contractAddress: lock.contractAddress,
    assetAddress: lock.assetAddress,
    assetType: lock.assetType.toLowerCase(),
    positionManager: lock.positionManager,
    positionTokenId: lock.positionTokenId,
    launchTokenAddress: lock.launchTokenAddress,
    pairedAssetAddress: lock.pairedAssetAddress,
    poolAddress: lock.poolAddress,
    initialLiquidity: lock.initialLiquidity,
    lockType: lock.isPermanent ? "permanent" : lock.lockType.toLowerCase(),
    owner: lock.ownerAddress,
    beneficiary: lock.beneficiaryAddress,
    amount: lock.amount,
    withdrawnAmount: lock.withdrawnAmount,
    remainingLockedAmount: remainingAmount(lock).toString(),
    claimableAmount: claimable.toString(),
    startDate: lock.startTime.toISOString(),
    cliffDate: lock.cliffTime?.toISOString() ?? null,
    unlockDate: lock.isPermanent ? null : lock.endTime?.toISOString() ?? null,
    vestingInterval: lock.vestingInterval,
    isPermanent: lock.isPermanent,
    metadataURI: lock.metadataURI,
    lockedPercentage: lock.lockedPercentage?.toString() ?? null,
    tvlUsd: lock.tvlUsd?.toString() ?? null,
    valueSource: lock.tvlUsd ? "estimated_fiat" : "unavailable",
    accruedFees: lock.assetType === AssetType.V3_POSITION ? {
      token0: null,
      token1: null,
      valueUsd: null,
      source: "unavailable",
      note: "Accrued trading fees are separate from locked liquidity and are not included in TVL unless indexed fee data is available."
    } : null,
    feeCollectionHistory: feeEvents.map((event) => ({
      txHash: event.txHash,
      txUrl: txUrl(explorerUrl, event.txHash),
      blockNumber: event.blockNumber.toString(),
      logIndex: event.logIndex,
      createdAt: event.createdAt.toISOString(),
      payload: event.payload
    })),
    genesisPadLaunchVerification: lock.assetType === AssetType.V3_POSITION ? {
      verified: lock.events.some((event) => event.eventName === "PositionLockCreated"),
      source: "indexed_on_chain_event",
      label: "Official Genesis Launch Position",
      detail: "Permanent liquidity lock verified"
    } : null,
    token: lock.token,
    badges: badgesFor(lock),
    createdTxHash: lock.createdTxHash,
    createdTxUrl: lock.createdTxHash ? txUrl(explorerUrl, lock.createdTxHash) : null,
    events: lock.events.map((event) => ({
      eventName: event.eventName,
      txHash: event.txHash,
      txUrl: txUrl(explorerUrl, event.txHash),
      blockNumber: event.blockNumber.toString(),
      logIndex: event.logIndex,
      payload: event.payload,
      createdAt: event.createdAt.toISOString()
    }))
  };
}

export async function getChains() {
  const stored = await db.chain.findMany({ include: { contracts: true }, orderBy: { id: "asc" } });
  if (stored.length === 0) {
    return chains.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      explorerUrl: c.explorerUrl,
      dotColor: c.dotColor,
      geckoTerminalId: c.geckoTerminalId ?? null,
      feeLabel: c.feeLabel,
      contracts: c.lockerAddress ? [{ address: c.lockerAddress.toLowerCase(), isRenounced: false, ownerAddress: null, creationFee: c.fee }] : []
    }));
  }

  return stored.map((chain) => ({
    id: chain.id,
    name: chain.name,
    symbol: chain.symbol,
    explorerUrl: chain.explorerUrl,
    dotColor: chain.dotColor,
    geckoTerminalId: chain.geckoTerminalId,
    feeLabel: chain.feeLabel,
    contracts: chain.contracts.map((contract) => ({
      address: contract.address,
      isRenounced: contract.isRenounced,
      ownerAddress: contract.ownerAddress,
      creationFee: contract.creationFee
    }))
  }));
}

export async function getGlobalStats() {
  const [rawLocks, feeStats, uniqueLockers] = await Promise.all([db.lock.findMany(), db.feeStat.findMany(), db.wallet.count()]);
  const locks = await filterDisplayLocks(rawLocks);
  const isLiquidityLock = (lock: Lock) => lock.assetType === AssetType.LP || lock.assetType === AssetType.V3_POSITION;
  const chainRows = await getChains();
  const byChain = chainRows.map((chain) => {
    const chainLocks = locks.filter((lock) => lock.chainId === chain.id);
    const chainFees = feeStats.filter((fee) => fee.chainId === chain.id).reduce((sum, fee) => sum + BigInt(fee.amount), 0n);
    return {
      chainId: chain.id,
      name: chain.name,
      totalLocks: chainLocks.length,
      totalActiveLocks: chainLocks.filter((lock) => remainingAmount(lock) > 0n && !lock.isPermanent).length,
      totalPermanentLocks: chainLocks.filter((lock) => lock.isPermanent).length,
      totalTvl: chainLocks.reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
      totalFeesCollected: chainFees.toString()
    };
  });

  return {
    totalLocks: locks.length,
    totalActiveLocks: locks.filter((lock) => remainingAmount(lock) > 0n && !lock.isPermanent).length,
    totalPermanentLocks: locks.filter((lock) => lock.isPermanent).length,
    totalTvl: locks.reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
    totalLpTvl: locks.filter(isLiquidityLock).reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
    totalTokenTvl: locks.filter((lock) => lock.assetType === AssetType.TOKEN).reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
    totalV3PositionLocks: locks.filter((lock) => lock.assetType === AssetType.V3_POSITION).length,
    totalV3AccruedFeesUsd: null,
    totalFeesCollected: feeStats.reduce((sum, fee) => sum + BigInt(fee.amount), 0n).toString(),
    uniqueLockers,
    byChain
  };
}

export async function listLockedPositions(limit = 100) {
  return listLocks({ limit, assetType: "v3_position" });
}

function liquidityPartnerRecord(lock: LockWithRelations, explorerUrl?: string | null) {
  return {
    chainId: lock.chainId,
    poolAddress: lock.assetType === AssetType.V3_POSITION ? lock.poolAddress : lock.assetAddress,
    assetAddress: lock.assetAddress,
    lockId: lock.lockId.toString(),
    lockContractAddress: lock.contractAddress,
    lockKind: lock.assetType === AssetType.V3_POSITION ? "v3_position" : "lp_token",
    isLocked: lock.isPermanent || remainingAmount(lock) > 0n,
    isPermanent: lock.isPermanent,
    lockedAmount: remainingAmount(lock).toString(),
    lockedPercentage: lock.lockedPercentage?.toString() ?? null,
    unlockDate: lock.isPermanent ? null : lock.endTime?.toISOString() ?? null,
    valueUsd: lock.tvlUsd?.toString() ?? null,
    owner: lock.ownerAddress,
    beneficiary: lock.beneficiaryAddress,
    positionManager: lock.positionManager,
    positionTokenId: lock.positionTokenId,
    createdTxHash: lock.createdTxHash,
    createdTxUrl: lock.createdTxHash ? txUrl(explorerUrl, lock.createdTxHash) : null,
    updatedAt: lock.updatedAt.toISOString()
  };
}

export async function listLiquidityLocks(options: { chainId?: number; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const chainsById = new Map((await db.chain.findMany()).map((chain) => [chain.id, chain]));
  const locks = await db.lock.findMany({
    where: {
      ...(options.chainId ? { chainId: options.chainId } : {}),
      assetType: { in: [AssetType.LP, AssetType.V3_POSITION] }
    },
    include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
    orderBy: { createdAt: "desc" },
    take: limit
  }) as LockWithRelations[];

  return {
    updatedAt: new Date().toISOString(),
    locks: locks
      .filter((lock) => lock.isPermanent || remainingAmount(lock) > 0n)
      .map((lock) => liquidityPartnerRecord(lock, chainsById.get(lock.chainId)?.explorerUrl))
  };
}

export async function getPoolLockStatus(chainId: number, poolAddress: string) {
  const address = poolAddress.toLowerCase();
  const [chain, locks] = await Promise.all([
    db.chain.findUnique({ where: { id: chainId } }),
    db.lock.findMany({
      where: {
        chainId,
        OR: [
          { assetType: AssetType.LP, assetAddress: address },
          { assetType: AssetType.V3_POSITION, poolAddress: address }
        ]
      },
      include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
      orderBy: [{ isPermanent: "desc" }, { endTime: "desc" }]
    })
  ]);
  const activeLocks = (locks as LockWithRelations[]).filter((lock) => lock.isPermanent || remainingAmount(lock) > 0n);
  const timedUnlocks = activeLocks
    .filter((lock) => !lock.isPermanent && lock.endTime)
    .map((lock) => lock.endTime as Date)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    chainId,
    chain: chain?.name ?? chains.find((item) => item.id === chainId)?.name ?? null,
    poolAddress: address,
    isLiquidityLocked: activeLocks.length > 0,
    hasPermanentLock: activeLocks.some((lock) => lock.isPermanent),
    totalLockedAmount: activeLocks.reduce((sum, lock) => sum + remainingAmount(lock), 0n).toString(),
    lockedPercentage: activeLocks.some((lock) => lock.assetType === AssetType.V3_POSITION)
      ? null
      : activeLocks.reduce((sum, lock) => sum + Number(lock.lockedPercentage || 0), 0).toString(),
    totalValueUsd: activeLocks.reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
    longestUnlockDate: timedUnlocks[0]?.toISOString() ?? null,
    locks: activeLocks.map((lock) => liquidityPartnerRecord(lock, chain?.explorerUrl))
  };
}

export async function getTokenLockStatus(chainId: number, tokenAddress: string) {
  const address = tokenAddress.toLowerCase();
  const [chain, locks] = await Promise.all([
    db.chain.findUnique({ where: { id: chainId } }),
    db.lock.findMany({
      where: { chainId, assetType: AssetType.TOKEN, assetAddress: address },
      include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
      orderBy: [{ isPermanent: "desc" }, { endTime: "desc" }]
    })
  ]);
  const activeLocks = (locks as LockWithRelations[]).filter((lock) => lock.isPermanent || remainingAmount(lock) > 0n);
  const timedUnlocks = activeLocks.filter((lock) => !lock.isPermanent && lock.endTime).map((lock) => lock.endTime as Date).sort((a, b) => b.getTime() - a.getTime());
  return {
    chainId,
    chain: chain?.name ?? chains.find((item) => item.id === chainId)?.name ?? null,
    tokenAddress: address,
    isTokenLocked: activeLocks.length > 0,
    hasPermanentLock: activeLocks.some((lock) => lock.isPermanent),
    totalLockedAmount: activeLocks.reduce((sum, lock) => sum + remainingAmount(lock), 0n).toString(),
    lockedPercentage: activeLocks.reduce((sum, lock) => sum + Number(lock.lockedPercentage || 0), 0).toString(),
    totalValueUsd: activeLocks.reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString(),
    longestUnlockDate: timedUnlocks[0]?.toISOString() ?? null,
    locks: activeLocks.map((lock) => serializeLock(lock, chain?.explorerUrl))
  };
}

function encodeEventCursor(blockNumber: bigint, logIndex: number) {
  return Buffer.from(JSON.stringify({ blockNumber: blockNumber.toString(), logIndex }), "utf8").toString("base64url");
}

function decodeEventCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { blockNumber?: string; logIndex?: number };
    if (!parsed.blockNumber || !/^\d+$/.test(parsed.blockNumber) || !Number.isInteger(parsed.logIndex) || parsed.logIndex! < 0) return null;
    return { blockNumber: BigInt(parsed.blockNumber), logIndex: parsed.logIndex! };
  } catch { return null; }
}

export async function listPartnerLockEvents(options: { chainId: number; cursor?: string; limit?: number }) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const cursor = decodeEventCursor(options.cursor);
  if (options.cursor && !cursor) throw new Error("invalid_cursor");
  const [rows, cursors] = await Promise.all([
    db.lockEvent.findMany({
      where: { chainId: options.chainId, ...(cursor ? { OR: [{ blockNumber: { gt: cursor.blockNumber } }, { blockNumber: cursor.blockNumber, logIndex: { gt: cursor.logIndex } }] } : {}) },
      include: { lock: true }, orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }], take: limit + 1
    }),
    db.indexCursor.findMany({ where: { chainId: options.chainId }, select: { lastBlock: true, updatedAt: true } })
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const syncedThroughBlock = cursors.length > 0 ? cursors.reduce((minimum, item) => item.lastBlock < minimum ? item.lastBlock : minimum, cursors[0].lastBlock) : null;
  return {
    chainId: options.chainId,
    events: page.map((event) => ({
      eventName: event.eventName, transactionHash: event.txHash, blockNumber: event.blockNumber.toString(), logIndex: event.logIndex,
      observedAt: event.createdAt.toISOString(),
      tokenAddress: event.lock?.launchTokenAddress ?? (event.lock?.assetType === AssetType.TOKEN ? event.lock.assetAddress : null),
      poolAddress: event.lock?.poolAddress ?? (event.lock?.assetType === AssetType.LP ? event.lock.assetAddress : null),
      assetAddress: event.lock?.assetAddress ?? null, lockId: event.lock?.lockId.toString() ?? event.lockId?.toString() ?? null,
      lockContractAddress: event.lock?.contractAddress ?? null
    })),
    nextCursor: last ? encodeEventCursor(last.blockNumber, last.logIndex) : options.cursor ?? null,
    hasMore, syncedThroughBlock: syncedThroughBlock?.toString() ?? null,
    indexedAt: cursors.length > 0 ? cursors.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, cursors[0].updatedAt).toISOString() : null
  };
}

export async function getAssetStatus(chainId: number, assetAddress?: string, lockId?: bigint, contractAddress?: string) {
  const lockWhere = lockId
    ? {
      chainId,
      lockId,
      ...(contractAddress ? { contractAddress: contractAddress.toLowerCase() } : {})
    }
    : { chainId, assetAddress: assetAddress?.toLowerCase() };

  const locks = await db.lock.findMany({
      where: lockWhere,
      include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
      orderBy: [{ isPermanent: "desc" }, { endTime: "desc" }]
    }) as LockWithRelations[];

  const [chain, contract] = await Promise.all([
    db.chain.findUnique({ where: { id: chainId } }),
    db.contract.findFirst({ where: { chainId } })
  ]);

  const first = locks[0];
  // Sum every lock's own share of supply, not just the most recent lock's -
  // an asset with three separate 20% locks has 60% locked in total, not 20%.
  const totalLockedPercentage = locks.length > 0
    ? locks.reduce((sum, lock) => sum + Number(lock.lockedPercentage || 0), 0)
    : undefined;
  return {
    chainId,
    chain: chain?.name ?? chains.find((chain) => chain.id === chainId)?.name ?? null,
    assetAddress: assetAddress || first?.assetAddress,
    assetType: first?.assetType?.toLowerCase() || null,
    isLocked: locks.length > 0,
    hasPermanentLock: locks.some((lock) => lock.isPermanent),
    totalLockedAmount: locks.reduce((sum, lock) => sum + remainingAmount(lock), 0n).toString(),
    lockedPercentage: first?.assetType === AssetType.V3_POSITION ? null : totalLockedPercentage !== undefined ? totalLockedPercentage.toString() : null,
    longestUnlockDate: dateToIso(first?.endTime),
    warnings: [...new Set(locks.flatMap((lock) => buildWarnings(lock, totalLockedPercentage)))],
    badges: [...new Set(locks.flatMap((lock) => badgesFor(lock)))],
    contract: contract ? {
      address: contract.address,
      isRenounced: contract.isRenounced,
      ownerAddress: contract.ownerAddress
    } : null,
    locks: locks.map((lock) => serializeLock(lock, chain?.explorerUrl))
  };
}

export async function listLocks(filters: number | LockListFilters = 50) {
  const options: LockListFilters = typeof filters === "number" ? { limit: filters } : filters;
  const limit = options.limit ?? 50;
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const where = {
    ...(options.assetType ? {
      assetType: options.assetType === "token" ? AssetType.TOKEN : options.assetType === "lp" ? AssetType.LP : AssetType.V3_POSITION
    } : {}),
    ...(options.lockType === "vesting" ? { lockType: LockType.VESTING } : {}),
    ...(options.lockType === "permanent" ? { isPermanent: true } : {}),
    ...(options.lockType === "timed" ? { isPermanent: false, lockType: LockType.CLIFF } : {}),
    ...(options.unlockingSoon ? { isPermanent: false, endTime: { gte: now, lte: soon } } : {})
  };
  const chainsById = new Map((await db.chain.findMany()).map((chain) => [chain.id, chain]));
  const locks = await filterDisplayLocks(await db.lock.findMany({
    where,
    include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100)
  }) as LockWithRelations[]);

  return {
    locks: locks.map((lock) => serializeLock(lock, chainsById.get(lock.chainId)?.explorerUrl))
  };
}

export async function getWalletLocks(chainId: number, walletAddress: string) {
  const chain = await db.chain.findUnique({ where: { id: chainId } });
  const locks = await filterDisplayLocks(await db.lock.findMany({
    where: {
      chainId,
      OR: [
        { ownerAddress: walletAddress.toLowerCase() },
        { beneficiaryAddress: walletAddress.toLowerCase() }
      ]
    },
    include: { token: true, events: { orderBy: [{ blockNumber: "asc" }, { logIndex: "asc" }] } },
    orderBy: { createdAt: "desc" }
  }) as LockWithRelations[]);
  return { chainId, walletAddress, locks: locks.map((lock) => serializeLock(lock, chain?.explorerUrl)) };
}

export async function search(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { query, results: [] };

  const [tokens, pairs, locks] = await Promise.all([
    db.token.findMany({ where: { OR: [{ address: q }, { symbol: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }, take: 20 }),
    db.pair.findMany({ where: { address: q }, take: 20 }),
    db.lock.findMany({
      where: {
        OR: [
          { assetAddress: q },
          { ownerAddress: q },
          { beneficiaryAddress: q },
          { poolAddress: q },
          { positionManager: q },
          { positionTokenId: q },
          ...(q.match(/^\d+$/) ? [{ lockId: BigInt(q) }] : [])
        ]
      },
      take: 20
    })
  ]);

  return {
    query,
    results: [
      ...tokens.map((token) => ({ type: "token", chainId: token.chainId, address: token.address, name: token.name, symbol: token.symbol, totalSupply: token.totalSupply })),
      ...pairs.map((pair) => ({ type: "pair", chainId: pair.chainId, address: pair.address, token0: pair.token0, token1: pair.token1, reserveUsd: pair.reserveUsd?.toString() ?? null })),
      ...locks.map((lock) => ({ type: "lock", chainId: lock.chainId, lockId: lock.lockId.toString(), assetAddress: lock.assetAddress, isPermanent: lock.isPermanent, lockedPercentage: lock.lockedPercentage?.toString() ?? null }))
    ]
  };
}

export const lockMath = {
  claimableAmount,
  remainingAmount
};
