import { AssetType, LockType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { lockMath } from "./locks.js";

const baseLock = {
  id: "lock-db-id",
  chainId: 8453,
  lockId: 1n,
  contractAddress: "0xlocker",
  assetAddress: "0xasset",
  assetType: AssetType.TOKEN,
  lockType: LockType.CLIFF,
  ownerAddress: "0xowner",
  beneficiaryAddress: "0xbeneficiary",
  amount: "1000",
  withdrawnAmount: "250",
  startTime: new Date("2026-01-01T00:00:00Z"),
  cliffTime: new Date("2026-01-08T00:00:00Z"),
  endTime: new Date("2026-01-08T00:00:00Z"),
  vestingInterval: null,
  isPermanent: false,
  metadataURI: null,
  tvlUsd: null,
  lockedPercentage: null,
  createdTxHash: null,
  createdBlockNumber: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

describe("lockMath", () => {
  it("calculates remaining locked amount", () => {
    expect(lockMath.remainingAmount(baseLock).toString()).toBe("750");
  });

  it("returns full remaining amount for unlocked cliff locks", () => {
    expect(lockMath.claimableAmount(baseLock, new Date("2026-01-09T00:00:00Z")).toString()).toBe("750");
  });

  it("returns zero for permanent locks", () => {
    expect(lockMath.claimableAmount({ ...baseLock, isPermanent: true }, new Date("2026-01-09T00:00:00Z")).toString()).toBe("0");
  });

  it("calculates interval-based vesting claimable amount", () => {
    const vesting = {
      ...baseLock,
      lockType: LockType.VESTING,
      amount: "1000",
      withdrawnAmount: "100",
      cliffTime: new Date("2026-01-01T00:00:00Z"),
      endTime: new Date("2026-01-11T00:00:00Z"),
      vestingInterval: 24 * 60 * 60
    };

    expect(lockMath.claimableAmount(vesting, new Date("2026-01-06T00:00:00Z")).toString()).toBe("400");
  });
});
