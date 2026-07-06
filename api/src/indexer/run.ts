import { Interface, JsonRpcProvider } from "ethers";
import { chains, indexerBatchSize, indexerConfirmations } from "../config.js";
import { genesisLockerAbi } from "../contracts/genesisLockerAbi.js";
import { db } from "../db.js";
import { syncContractMetadata } from "../services/metadata.js";
import { seedConfiguredChains } from "./seed.js";
import { applyGenesisLockerEvent } from "./reducer.js";
import { isRpcReachable } from "./rpc.js";

const iface = new Interface(genesisLockerAbi);

async function indexChain(chain: (typeof chains)[number]) {
  if (!chain.rpcUrl || !chain.lockerAddress) return;

  const contractAddress = chain.lockerAddress.toLowerCase();
  const provider = new JsonRpcProvider(chain.rpcUrl);
  if (!(await isRpcReachable(chain.rpcUrl))) {
    console.warn(`Skipping ${chain.name}: RPC is not reachable`);
    return;
  }
  await syncContractMetadata(chain.id, contractAddress, provider);

  const latest = await provider.getBlockNumber();
  const safeLatest = Math.max(0, latest - indexerConfirmations);
  const cursor = await db.indexCursor.findUnique({
    where: { chainId_contractAddress: { chainId: chain.id, contractAddress } }
  });

  let fromBlock = Number(cursor?.lastBlock ?? 0n) + 1;
  if (fromBlock > safeLatest) return;

  while (fromBlock <= safeLatest) {
    const toBlock = Math.min(fromBlock + indexerBatchSize - 1, safeLatest);
    const logs = await provider.getLogs({ address: contractAddress, fromBlock, toBlock });

    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (parsed) {
        await applyGenesisLockerEvent(db, chain.id, contractAddress, log, parsed, provider);
      }
    }

    await db.indexCursor.upsert({
      where: { chainId_contractAddress: { chainId: chain.id, contractAddress } },
      create: { chainId: chain.id, contractAddress, lastBlock: BigInt(toBlock) },
      update: { lastBlock: BigInt(toBlock) }
    });

    fromBlock = toBlock + 1;
  }
}

await seedConfiguredChains();

for (const chain of chains) {
  await indexChain(chain);
}

await db.$disconnect();
