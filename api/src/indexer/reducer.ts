import { AssetType, LockType, PrismaClient } from "@prisma/client";
import { Contract, EventLog, Log, ZeroAddress } from "ethers";
import { refreshAssetCalculations, refreshV3PositionLockValue, syncAssetMetadata } from "../services/metadata.js";
import { JsonRpcProvider } from "ethers";

type ParsedLog = ReturnType<import("ethers").Interface["parseLog"]>;

function asDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000);
}

function serializeArgs(args: unknown) {
  return JSON.parse(JSON.stringify(args, (_key, value) => typeof value === "bigint" ? value.toString() : value));
}

function lockIdFrom(parsed: NonNullable<ParsedLog>) {
  return parsed.args.lockId === undefined ? null : BigInt(parsed.args.lockId);
}

function positionTokenIdFrom(parsed: NonNullable<ParsedLog>) {
  return parsed.args.tokenId === undefined ? null : BigInt(parsed.args.tokenId);
}

export async function applyGenesisLockerEvent(
  db: PrismaClient,
  chainId: number,
  contractAddress: string,
  log: Log | EventLog,
  parsed: NonNullable<ParsedLog>,
  provider?: JsonRpcProvider
) {
  const normalizedContract = contractAddress.toLowerCase();
  const lockId = lockIdFrom(parsed);
  const existingLock = lockId === null ? null : await db.lock.findUnique({ where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } } });

  await db.lockEvent.upsert({
    where: { chainId_txHash_logIndex: { chainId, txHash: log.transactionHash, logIndex: log.index } },
    create: {
      chainId,
      lockDbId: existingLock?.id,
      lockId,
      eventName: parsed.name,
      txHash: log.transactionHash,
      blockNumber: BigInt(log.blockNumber),
      logIndex: log.index,
      payload: serializeArgs(parsed.args)
    },
    update: {
      lockDbId: existingLock?.id,
      lockId,
      eventName: parsed.name,
      blockNumber: BigInt(log.blockNumber),
      payload: serializeArgs(parsed.args)
    }
  });

  if (parsed.name === "LockCreated") {
    const a = parsed.args;
    const assetAddress = String(a.token).toLowerCase();
    const ownerAddress = String(a.owner).toLowerCase();
    const beneficiaryAddress = String(a.beneficiary).toLowerCase();
    const assetType = a.isLpToken ? AssetType.LP : AssetType.TOKEN;

    await db.wallet.upsert({
      where: { address: ownerAddress },
      create: { address: ownerAddress },
      update: {}
    });

    await db.token.upsert({
      where: { chainId_address: { chainId, address: assetAddress } },
      create: { chainId, address: assetAddress },
      update: {}
    });

    const createdLock = await db.lock.upsert({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId: BigInt(a.lockId) } },
      create: {
        chainId,
        lockId: BigInt(a.lockId),
        contractAddress: normalizedContract,
        assetAddress,
        assetType,
        lockType: a.isVesting ? LockType.VESTING : LockType.CLIFF,
        ownerAddress,
        beneficiaryAddress,
        amount: String(a.amount),
        startTime: asDate(BigInt(a.startTime)),
        cliffTime: asDate(BigInt(a.cliffTime)),
        endTime: asDate(BigInt(a.endTime)),
        vestingInterval: Number(a.vestingInterval),
        metadataURI: String(a.metadataURI),
        createdTxHash: log.transactionHash,
        createdBlockNumber: BigInt(log.blockNumber)
      },
      update: {
        contractAddress: normalizedContract,
        assetAddress,
        assetType,
        lockType: a.isVesting ? LockType.VESTING : LockType.CLIFF,
        ownerAddress,
        beneficiaryAddress,
        amount: String(a.amount),
        startTime: asDate(BigInt(a.startTime)),
        cliffTime: asDate(BigInt(a.cliffTime)),
        endTime: asDate(BigInt(a.endTime)),
        vestingInterval: Number(a.vestingInterval),
        metadataURI: String(a.metadataURI),
        createdTxHash: log.transactionHash,
        createdBlockNumber: BigInt(log.blockNumber)
      }
    });

    await db.lockEvent.update({
      where: { chainId_txHash_logIndex: { chainId, txHash: log.transactionHash, logIndex: log.index } },
      data: { lockDbId: createdLock.id }
    });

    if (provider) {
      await syncAssetMetadata(chainId, assetAddress, assetType, provider);
    }
    await refreshAssetCalculations(chainId, assetAddress);
    return;
  }

  if (lockId === null) return;
  const lock = existingLock ?? await db.lock.findUnique({ where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } } });
  if (!lock) return;

  if (parsed.name === "LockExtended") {
    await db.lock.update({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
      data: {
        endTime: asDate(BigInt(parsed.args.newEndTime)),
        cliffTime: lock.lockType === LockType.CLIFF ? asDate(BigInt(parsed.args.newEndTime)) : undefined
      }
    });
  }

  if (parsed.name === "LockAmountIncreased") {
    await db.lock.update({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
      data: { amount: String(parsed.args.newAmount) }
    });
  }

  if (parsed.name === "LockOwnershipTransferred") {
    const newOwner = String(parsed.args.newOwner).toLowerCase();
    await db.wallet.upsert({
      where: { address: newOwner },
      create: { address: newOwner },
      update: {}
    });
    await db.lock.update({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
      // Owner and beneficiary move together on-chain, so mirror both here.
      data: { ownerAddress: newOwner, beneficiaryAddress: newOwner }
    });
  }

  if (parsed.name === "LockPermanentlyLocked") {
    await db.lock.update({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
      data: { isPermanent: true, lockType: LockType.PERMANENT }
    });
  }

  if (parsed.name === "Withdrawn") {
    const withdrawnAmount = BigInt(lock.withdrawnAmount) + BigInt(parsed.args.amount);
    await db.lock.update({
      where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
      data: { withdrawnAmount: withdrawnAmount.toString() }
    });
  }

  if (parsed.name === "FeeCollected") {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const existing = await db.feeStat.findUnique({ where: { chainId_date: { chainId, date: today } } });
    const amount = BigInt(existing?.amount || "0") + BigInt(parsed.args.amount);
    await db.feeStat.upsert({
      where: { chainId_date: { chainId, date: today } },
      create: { chainId, date: today, amount: amount.toString() },
      update: { amount: amount.toString() }
    });
  }

  await refreshAssetCalculations(chainId, lock.assetAddress);
}

export async function applyGenesisV3PositionLockerEvent(
  db: PrismaClient,
  chainId: number,
  contractAddress: string,
  log: Log | EventLog,
  parsed: NonNullable<ParsedLog>,
  provider?: JsonRpcProvider
) {
  const normalizedContract = contractAddress.toLowerCase();
  const tokenId = positionTokenIdFrom(parsed);
  const positionManager = parsed.args.positionManager === undefined ? null : String(parsed.args.positionManager).toLowerCase();
  const existingLock = tokenId === null || !positionManager
    ? null
    : await db.lock.findFirst({
      where: { chainId, contractAddress: normalizedContract, positionManager, positionTokenId: tokenId.toString() }
    });

  await db.lockEvent.upsert({
    where: { chainId_txHash_logIndex: { chainId, txHash: log.transactionHash, logIndex: log.index } },
    create: {
      chainId,
      lockDbId: existingLock?.id,
      lockId: tokenId,
      eventName: parsed.name,
      txHash: log.transactionHash,
      blockNumber: BigInt(log.blockNumber),
      logIndex: log.index,
      payload: serializeArgs(parsed.args)
    },
    update: {
      lockDbId: existingLock?.id,
      lockId: tokenId,
      eventName: parsed.name,
      blockNumber: BigInt(log.blockNumber),
      payload: serializeArgs(parsed.args)
    }
  });

  if (parsed.name !== "PositionLockCreated" || tokenId === null || !positionManager) return;

  const launchToken = String(parsed.args.launchToken).toLowerCase();
  const pairedAsset = String(parsed.args.pairedAsset).toLowerCase();
  const pool = String(parsed.args.pool).toLowerCase();
  let originalDepositor = ZeroAddress.toLowerCase();
  let beneficiary = ZeroAddress.toLowerCase();
  let lockedAt = BigInt(Math.floor(Date.now() / 1000));
  let permanent = true;

  if (provider) {
    try {
      const { genesisV3PositionLockerAbi } = await import("../contracts/genesisLockerAbi.js");
      const locker = new Contract(normalizedContract, genesisV3PositionLockerAbi, provider);
      const lock = await locker.getLock(positionManager, tokenId);
      originalDepositor = String(lock.originalDepositor).toLowerCase();
      beneficiary = String(lock.beneficiary).toLowerCase();
      lockedAt = BigInt(lock.lockedAt);
      permanent = Boolean(lock.permanent);
    } catch {
      // Event facts still prove the position NFT was accepted and locked.
    }
  }

  await db.wallet.upsert({
    where: { address: originalDepositor },
    create: { address: originalDepositor },
    update: {}
  });

  await db.token.upsert({
    where: { chainId_address: { chainId, address: launchToken } },
    create: { chainId, address: launchToken },
    update: {}
  });

  const lockId = tokenId;
  const createdLock = await db.lock.upsert({
    where: { chainId_contractAddress_lockId: { chainId, contractAddress: normalizedContract, lockId } },
    create: {
      chainId,
      lockId,
      contractAddress: normalizedContract,
      assetAddress: launchToken,
      assetType: AssetType.V3_POSITION,
      positionManager,
      positionTokenId: tokenId.toString(),
      launchTokenAddress: launchToken,
      pairedAssetAddress: pairedAsset,
      poolAddress: pool,
      initialLiquidity: String(parsed.args.initialLiquidity),
      lockType: LockType.PERMANENT,
      ownerAddress: originalDepositor,
      beneficiaryAddress: beneficiary,
      amount: String(parsed.args.initialLiquidity),
      startTime: asDate(lockedAt),
      cliffTime: null,
      endTime: null,
      vestingInterval: null,
      isPermanent: permanent,
      createdTxHash: log.transactionHash,
      createdBlockNumber: BigInt(log.blockNumber)
    },
    update: {
      assetAddress: launchToken,
      assetType: AssetType.V3_POSITION,
      positionManager,
      positionTokenId: tokenId.toString(),
      launchTokenAddress: launchToken,
      pairedAssetAddress: pairedAsset,
      poolAddress: pool,
      initialLiquidity: String(parsed.args.initialLiquidity),
      lockType: LockType.PERMANENT,
      ownerAddress: originalDepositor,
      beneficiaryAddress: beneficiary,
      amount: String(parsed.args.initialLiquidity),
      startTime: asDate(lockedAt),
      isPermanent: permanent,
      createdTxHash: log.transactionHash,
      createdBlockNumber: BigInt(log.blockNumber)
    }
  });

  await db.lockEvent.update({
    where: { chainId_txHash_logIndex: { chainId, txHash: log.transactionHash, logIndex: log.index } },
    data: { lockDbId: createdLock.id }
  });

  if (provider) {
    await syncAssetMetadata(chainId, launchToken, AssetType.TOKEN, provider).catch(() => undefined);
  }
  await refreshV3PositionLockValue(createdLock.id);
}
