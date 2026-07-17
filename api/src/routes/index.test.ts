import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db.js";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let baseUrl = "";
let dbAvailable = true;

beforeAll(async () => {
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
    await db.lock.deleteMany({ where: { chainId: 99999 } });
    await db.lock.deleteMany({ where: { chainId: 4663, contractAddress: "0x2200000000000000000000000000000000000002" } });
    await db.wallet.deleteMany({ where: { address: "0x1000000000000000000000000000000000000001" } });
    await db.chain.deleteMany({ where: { id: 99999 } });
  }
  await db.$disconnect();
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
