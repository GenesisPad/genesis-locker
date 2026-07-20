import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db.js";
import { resetPartnerApiStateForTests } from "../middleware/partnerApi.js";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let baseUrl = "";
let dbAvailable = true;

beforeAll(async () => {
  process.env.PARTNER_API_KEYS = "dexscreener:test-partner-key";
  process.env.PARTNER_RATE_LIMIT_MAX = "600";
  resetPartnerApiStateForTests();
  try {
    await db.chain.upsert({
    where: { id: 99999 },
    create: { id: 99999, name: "Local Test", symbol: "ETH", rpcEnvKey: "ROUTE_TEST_RPC_URL", explorerUrl: "http://localhost:8545" },
    update: { name: "Local Test" }
    });

    await db.wallet.upsert({
    where: { address: "0x1000000000000000000000000000000000000001" },
    create: { address: "0x1000000000000000000000000000000000000001" },
    update: {}
    });

    await db.lock.upsert({
    where: {
      chainId_contractAddress_lockId: {
        chainId: 99999,
        contractAddress: "0x2000000000000000000000000000000000000002",
        lockId: 9001n
      }
    },
    create: {
      chainId: 99999,
      lockId: 9001n,
      contractAddress: "0x2000000000000000000000000000000000000002",
      assetAddress: "0x3000000000000000000000000000000000000003",
      assetType: "V3_POSITION",
      positionManager: "0x4000000000000000000000000000000000000004",
      positionTokenId: "123",
      launchTokenAddress: "0x3000000000000000000000000000000000000003",
      pairedAssetAddress: "0x5000000000000000000000000000000000000005",
      poolAddress: "0x6000000000000000000000000000000000000006",
      initialLiquidity: "777",
      lockType: "PERMANENT",
      ownerAddress: "0x1000000000000000000000000000000000000001",
      beneficiaryAddress: "0x1000000000000000000000000000000000000001",
      amount: "777",
      tvlUsd: "1234.56",
      startTime: new Date(),
      isPermanent: true
    },
    update: {}
    });

    const partnerLock = await db.lock.findUniqueOrThrow({
      where: { chainId_contractAddress_lockId: { chainId: 99999, contractAddress: "0x2000000000000000000000000000000000000002", lockId: 9001n } }
    });
    await db.lockEvent.upsert({
      where: { chainId_txHash_logIndex: { chainId: 99999, txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", logIndex: 1 } },
      create: { chainId: 99999, lockDbId: partnerLock.id, lockId: 9001n, eventName: "PositionLockCreated", txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", blockNumber: 100n, logIndex: 1, payload: {} },
      update: { lockDbId: partnerLock.id }
    });

    await db.chain.upsert({
      where: { id: 4663 },
      create: { id: 4663, name: "Robinhood Chain", symbol: "ETH", rpcEnvKey: "ROBINHOOD_RPC_URL", explorerUrl: "https://robinhoodchain.blockscout.com" },
      update: { name: "Robinhood Chain" }
    });

    await db.lock.upsert({
      where: {
        chainId_contractAddress_lockId: {
          chainId: 4663,
          contractAddress: "0x2200000000000000000000000000000000000002",
          lockId: 9901n
        }
      },
      create: {
        chainId: 4663,
        lockId: 9901n,
        contractAddress: "0x2200000000000000000000000000000000000002",
        assetAddress: "0x3100000000000000000000000000000000000003",
        assetType: "V3_POSITION",
        positionManager: "0x4100000000000000000000000000000000000004",
        positionTokenId: "sidecar-test",
        launchTokenAddress: "0x3100000000000000000000000000000000000003",
        pairedAssetAddress: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
        poolAddress: "0x6100000000000000000000000000000000000006",
        initialLiquidity: "1000",
        lockType: "PERMANENT",
        ownerAddress: "0x1000000000000000000000000000000000000001",
        beneficiaryAddress: "0x1000000000000000000000000000000000000001",
        amount: "1000",
        tvlUsd: "500",
        startTime: new Date(),
        isPermanent: true
      },
      update: {}
    });

    await db.lock.upsert({
      where: {
        chainId_contractAddress_lockId: {
          chainId: 4663,
          contractAddress: "0x2200000000000000000000000000000000000002",
          lockId: 9902n
        }
      },
      create: {
        chainId: 4663,
        lockId: 9902n,
        contractAddress: "0x2200000000000000000000000000000000000002",
        assetAddress: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
        assetType: "TOKEN",
        lockType: "PERMANENT",
        ownerAddress: "0x1000000000000000000000000000000000000001",
        beneficiaryAddress: "0x1000000000000000000000000000000000000001",
        amount: "1000",
        tvlUsd: "500",
        startTime: new Date(),
        isPermanent: true
      },
      update: {}
    });
  } catch {
    dbAvailable = false;
    return;
  }

  server = createApp().listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (dbAvailable) {
    await db.lockEvent.deleteMany({ where: { chainId: 99999 } });
    await db.lock.deleteMany({ where: { chainId: 99999 } });
    await db.lock.deleteMany({ where: { chainId: 4663, contractAddress: "0x2200000000000000000000000000000000000002" } });
    await db.wallet.deleteMany({ where: { address: "0x1000000000000000000000000000000000000001" } });
    await db.chain.deleteMany({ where: { id: 99999 } });
  }
  await db.$disconnect();
  delete process.env.PARTNER_API_KEYS;
});

describe("API routes", () => {
  it("serves DB-backed chains", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/chains`);
    expect(response.status).toBe(200);
    const chains = await response.json() as Array<{ id: number; name: string }>;
    expect(chains.some((chain) => chain.id === 99999 && chain.name === "Local Test")).toBe(true);
  });

  it("serves the lock explorer list shape", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/locks`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: unknown[] };
    expect(Array.isArray(body.locks)).toBe(true);
  });

  it("filters V3 position locks", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/locks?assetType=v3_position`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: Array<{ assetType: string; positionTokenId: string }> };
    expect(body.locks.some((lock) => lock.assetType === "v3_position" && lock.positionTokenId === "123")).toBe(true);
  });

  it("hides wrapped-native sidecar token locks when a V3 position already accounts for them", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/locks?limit=20`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: Array<{ lockId: string; assetType: string; pairedAssetAddress?: string | null }> };
    expect(body.locks.some((lock) => lock.lockId === "9901" && lock.assetType === "v3_position")).toBe(true);
    expect(body.locks.some((lock) => lock.lockId === "9902")).toBe(false);
  });

  it("serves locked positions through the positions route", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/positions`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: Array<{ assetType: string; positionTokenId: string }> };
    expect(body.locks.some((lock) => lock.assetType === "v3_position" && lock.positionTokenId === "123")).toBe(true);
  });

  it("serves a partner-friendly liquidity lock feed", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/liquidity-locks?chainId=99999`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: Array<{ poolAddress: string; isLocked: boolean; isPermanent: boolean; valueUsd: string | null }> };
    expect(body.locks.some((lock) => lock.poolAddress === "0x6000000000000000000000000000000000000006" && lock.isLocked && lock.isPermanent && lock.valueUsd === "1234.56")).toBe(true);
  });

  it("checks liquidity lock status by pool address", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/pools/99999/0x6000000000000000000000000000000000000006/locks`);
    expect(response.status).toBe(200);
    const body = await response.json() as { isLiquidityLocked: boolean; hasPermanentLock: boolean; totalValueUsd: string; locks: unknown[] };
    expect(body.isLiquidityLocked).toBe(true);
    expect(body.hasPermanentLock).toBe(true);
    expect(Number(body.totalValueUsd)).toBeGreaterThanOrEqual(1234.56);
    expect(body.locks.length).toBeGreaterThan(0);
  });

  it("requires a partner API key for partner lookups", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/partner/pools/99999/0x6000000000000000000000000000000000000006/locks`);
    expect(response.status).toBe(401);
  });

  it("serves cached partner pool lookups with quota headers", async () => {
    if (!dbAvailable) return;
    const url = `${baseUrl}/v1/partner/pools/99999/0x6000000000000000000000000000000000000006/locks`;
    const first = await fetch(url, { headers: { "x-api-key": "test-partner-key" } });
    expect(first.status).toBe(200);
    expect(first.headers.get("ratelimit-limit")).toBe("600");
    expect(first.headers.get("x-genesis-cache")).toBe("MISS");
    const etag = first.headers.get("etag");
    const second = await fetch(url, { headers: { "x-api-key": "test-partner-key", "if-none-match": etag! } });
    expect(second.status).toBe(304);
    expect(second.headers.get("x-genesis-cache")).toBe("HIT");
  });

  it("aggregates active token locks for partner token lookups", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/partner/tokens/4663/0x0bd7d308f8e1639fab988df18a8011f41eacad73/locks`, { headers: { "x-api-key": "test-partner-key" } });
    expect(response.status).toBe(200);
    const body = await response.json() as { isTokenLocked: boolean; totalLockedAmount: string; totalValueUsd: string; locks: unknown[] };
    expect(body.isTokenLocked).toBe(true);
    expect(body.totalLockedAmount).toBe("1000");
    expect(body.totalValueUsd).toBe("500");
    expect(body.locks).toHaveLength(1);
  });

  it("paginates partner lock changes with a durable cursor", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/partner/liquidity-lock-events?chainId=99999&limit=1`, { headers: { authorization: "Bearer test-partner-key" } });
    expect(response.status).toBe(200);
    const body = await response.json() as { events: Array<{ blockNumber: string; poolAddress: string }>; nextCursor: string; hasMore: boolean };
    expect(body.events[0]).toMatchObject({ blockNumber: "100", poolAddress: "0x6000000000000000000000000000000000000006" });
    expect(body.nextCursor).toBeTruthy();
    expect(typeof body.hasMore).toBe("boolean");
  });

  it("returns a retry delay when a partner exceeds its quota", async () => {
    if (!dbAvailable) return;
    process.env.PARTNER_RATE_LIMIT_MAX = "1";
    resetPartnerApiStateForTests();
    const url = `${baseUrl}/v1/partner/pools/99999/0x6000000000000000000000000000000000000006/locks`;
    const first = await fetch(url, { headers: { "x-api-key": "test-partner-key" } });
    const limited = await fetch(url, { headers: { "x-api-key": "test-partner-key" } });
    expect(first.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    process.env.PARTNER_RATE_LIMIT_MAX = "600";
    resetPartnerApiStateForTests();
  });

  it("counts locked positions in liquidity TVL", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/stats/tvl`);
    expect(response.status).toBe(200);
    const body = await response.json() as { lpTvl: string };
    expect(Number(body.lpTvl)).toBeGreaterThanOrEqual(1234.56);
  });

  it("returns wallet locks through the unified my-locks route", async () => {
    if (!dbAvailable) return;
    const response = await fetch(`${baseUrl}/v1/my-locks/99999/0x1000000000000000000000000000000000000001`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: Array<{ lockId: string }> };
    expect(body.locks.some((lock) => lock.lockId === "9001")).toBe(true);
  });
});
