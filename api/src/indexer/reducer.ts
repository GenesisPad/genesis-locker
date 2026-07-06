import { AssetType, LockType, PrismaClient } from "@prisma/client";
import { EventLog, Log } from "ethers";
import { refreshAssetCalculations, syncAssetMetadata } from "../services/metadata.js";
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
  const existingLock = lockId === null ? null : await db.lock.findUnique({ where: { chainId_lockId: { chainId, lockId } } });

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
      where: { chainId_lockId: { chainId, lockId: BigInt(a.lockId) } },
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
  const lock = existingLock ?? await db.lock.findUnique({ where: { chainId_lockId: { chainId, lockId } } });
  if (!lock) return;

  if (parsed.name === "LockExtended") {
    await db.lock.update({
      where: { chainId_lockId: { chainId, lockId } },
      data: {
        endTime: asDate(BigInt(parsed.args.newEndTime)),
        cliffTime: lock.lockType === LockType.CLIFF ? asDate(BigInt(parsed.args.newEndTime)) : undefined
      }
    });
  }

  if (parsed.name === "LockAmountIncreased") {
    await db.lock.update({
      where: { chainId_lockId: { chainId, lockId } },
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
      where: { chainId_lockId: { chainId, lockId } },
      data: { ownerAddress: newOwner }
    });
  }

  if (parsed.name === "LockPermanentlyLocked") {
    await db.lock.update({
      where: { chainId_lockId: { chainId, lockId } },
      data: { isPermanent: true, lockType: LockType.PERMANENT }
    });
  }

  if (parsed.name === "Withdrawn") {
    const withdrawnAmount = BigInt(lock.withdrawnAmount) + BigInt(parsed.args.amount);
    await db.lock.update({
      where: { chainId_lockId: { chainId, lockId } },
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
