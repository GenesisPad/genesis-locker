import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { db } from "../db.js";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let baseUrl = "";

beforeAll(async () => {
  await db.chain.upsert({
    where: { id: 99999 },
    create: { id: 99999, name: "Local Test", symbol: "ETH", rpcEnvKey: "ROUTE_TEST_RPC_URL", explorerUrl: "http://localhost:8545" },
    update: { name: "Local Test" }
  });

  server = createApp().listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.chain.deleteMany({ where: { id: 99999 } });
  await db.$disconnect();
});

describe("API routes", () => {
  it("serves DB-backed chains", async () => {
    const response = await fetch(`${baseUrl}/v1/chains`);
    expect(response.status).toBe(200);
    const chains = await response.json() as Array<{ id: number; name: string }>;
    expect(chains.some((chain) => chain.id === 99999 && chain.name === "Local Test")).toBe(true);
  });

  it("serves the lock explorer list shape", async () => {
    const response = await fetch(`${baseUrl}/v1/locks`);
    expect(response.status).toBe(200);
    const body = await response.json() as { locks: unknown[] };
    expect(Array.isArray(body.locks)).toBe(true);
  });
});
