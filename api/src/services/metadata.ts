import { AssetType } from "@prisma/client";
import { Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import { db } from "../db.js";
import { erc20Abi, pairAbi, genesisLockerAbi } from "../contracts/genesisLockerAbi.js";

const mintSelectors = ["40c10f19", "6a627842"];
const blacklistSelectors = ["f9f92be4", "4ef4c3e1", "8f32d59b", "c4d66de8"];
const taxSelectors = ["2d0b93d2", "f2fde38b", "8f4ffcb1", "a9059cbb"];

function codeContainsAny(code: string, selectors: string[]) {
  const lower = code.toLowerCase();
  return selectors.some((selector) => lower.includes(selector));
}

export async function syncContractMetadata(chainId: number, contractAddress: string, provider: JsonRpcProvider) {
  const locker = new Contract(contractAddress, genesisLockerAbi, provider);
  let ownerAddress: string | null = null;
  let creationFee: string | null = null;

  try {
    ownerAddress = String(await locker.owner()).toLowerCase();
  } catch {
    ownerAddress = null;
  }

  try {
    creationFee = String(await locker.creationFee());
  } catch {
    creationFee = null;
  }

  return db.contract.upsert({
    where: { chainId_address: { chainId, address: contractAddress.toLowerCase() } },
    create: {
      chainId,
      address: contractAddress.toLowerCase(),
      ownerAddress,
      creationFee,
      isRenounced: ownerAddress === ZeroAddress
    },
    update: {
      ownerAddress,
      creationFee,
      isRenounced: ownerAddress === ZeroAddress
    }
  });
}

export async function syncAssetMetadata(chainId: number, assetAddress: string, assetType: AssetType, provider: JsonRpcProvider) {
  const address = assetAddress.toLowerCase();
  const token = new Contract(address, erc20Abi, provider);
  const [name, symbol, decimals, totalSupply, code] = await Promise.all([
    token.name().catch(() => null),
    token.symbol().catch(() => null),
    token.decimals().catch(() => null),
    token.totalSupply().catch(() => null),
    provider.getCode(address).catch(() => "0x")
  ]);

  await db.token.upsert({
    where: { chainId_address: { chainId, address } },
    create: {
      chainId,
      address,
      name: name ? String(name) : null,
      symbol: symbol ? String(symbol) : null,
      decimals: decimals === null ? null : Number(decimals),
      totalSupply: totalSupply === null ? null : String(totalSupply),
      hasMintRisk: codeContainsAny(code, mintSelectors),
      hasHighTaxRisk: codeContainsAny(code, taxSelectors),
      hasBlacklistRisk: codeContainsAny(code, blacklistSelectors)
    },
    update: {
      name: name ? String(name) : undefined,
      symbol: symbol ? String(symbol) : undefined,
      decimals: decimals === null ? undefined : Number(decimals),
      totalSupply: totalSupply === null ? undefined : String(totalSupply),
      hasMintRisk: codeContainsAny(code, mintSelectors),
      hasHighTaxRisk: codeContainsAny(code, taxSelectors),
      hasBlacklistRisk: codeContainsAny(code, blacklistSelectors)
    }
  });

  if (assetType === AssetType.LP) {
    const pair = new Contract(address, pairAbi, provider);
    const [token0, token1] = await Promise.all([
      pair.token0().catch(() => null),
      pair.token1().catch(() => null)
    ]);

    await db.pair.upsert({
      where: { chainId_address: { chainId, address } },
      create: {
        chainId,
        address,
        token0: token0 ? String(token0).toLowerCase() : null,
        token1: token1 ? String(token1).toLowerCase() : null,
        totalSupply: totalSupply === null ? null : String(totalSupply)
      },
      update: {
        token0: token0 ? String(token0).toLowerCase() : undefined,
        token1: token1 ? String(token1).toLowerCase() : undefined,
        totalSupply: totalSupply === null ? undefined : String(totalSupply)
      }
    });
  }
}

export async function refreshAssetCalculations(chainId: number, assetAddress: string) {
  const address = assetAddress.toLowerCase();
  const locks = await db.lock.findMany({ where: { chainId, assetAddress: address } });
  const remaining = locks.reduce((sum, lock) => sum + (BigInt(lock.amount) - BigInt(lock.withdrawnAmount)), 0n);
  const token = await db.token.findUnique({ where: { chainId_address: { chainId, address } } });
  const pair = await db.pair.findUnique({ where: { chainId_address: { chainId, address } } });
  const totalSupply = BigInt(pair?.totalSupply || token?.totalSupply || "0");
  const lockedPercentage = totalSupply > 0n ? Number((remaining * 100_000n) / totalSupply) / 1000 : null;

  let tvlUsd: number | null = null;
  if (pair?.reserveUsd && totalSupply > 0n) {
    tvlUsd = (Number(remaining) / Number(totalSupply)) * Number(pair.reserveUsd);
  } else if (token?.priceUsd) {
    const decimals = token.decimals ?? 18;
    tvlUsd = (Number(remaining) / 10 ** decimals) * Number(token.priceUsd);
  }

  await db.lock.updateMany({
    where: { chainId, assetAddress: address },
    data: {
      lockedPercentage,
      tvlUsd
    }
  });
}
