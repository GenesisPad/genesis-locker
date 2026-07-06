import { JsonRpcProvider } from "ethers";
import { fileURLToPath } from "node:url";
import { chains } from "../config.js";
import { db } from "../db.js";
import { syncContractMetadata } from "../services/metadata.js";
import { isRpcReachable } from "./rpc.js";

export async function seedConfiguredChains() {
  for (const chain of chains) {
    await db.chain.upsert({
      where: { id: chain.id },
      create: {
        id: chain.id,
        name: chain.name,
        symbol: chain.symbol,
        rpcEnvKey: chain.rpcEnvKey,
        explorerUrl: chain.explorerUrl,
        dotColor: chain.dotColor,
        geckoTerminalId: chain.geckoTerminalId ?? null,
        feeLabel: chain.feeLabel,
      },
      update: {
        name: chain.name,
        symbol: chain.symbol,
        rpcEnvKey: chain.rpcEnvKey,
        explorerUrl: chain.explorerUrl,
        dotColor: chain.dotColor,
        geckoTerminalId: chain.geckoTerminalId ?? null,
        feeLabel: chain.feeLabel,
      }
    });

    if (chain.rpcUrl && chain.lockerAddress) {
      const provider = new JsonRpcProvider(chain.rpcUrl);
      if (await isRpcReachable(chain.rpcUrl)) {
        await syncContractMetadata(chain.id, chain.lockerAddress, provider);
      } else {
        await db.contract.upsert({
          where: { chainId_address: { chainId: chain.id, address: chain.lockerAddress.toLowerCase() } },
          create: {
            chainId: chain.id,
            address: chain.lockerAddress.toLowerCase(),
            creationFee: chain.fee
          },
          update: {
            creationFee: chain.fee
          }
        });
      }
    } else if (chain.lockerAddress) {
      await db.contract.upsert({
        where: { chainId_address: { chainId: chain.id, address: chain.lockerAddress.toLowerCase() } },
        create: {
          chainId: chain.id,
          address: chain.lockerAddress.toLowerCase(),
          creationFee: chain.fee
        },
        update: {
          creationFee: chain.fee
        }
      });
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await seedConfiguredChains();
  await db.$disconnect();
}
