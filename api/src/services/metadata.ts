import { AssetType } from "@prisma/client";
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits } from "ethers";
import { db } from "../db.js";
import { erc20Abi, pairAbi, genesisLockerAbi } from "../contracts/genesisLockerAbi.js";
import { chains } from "../config.js";
import { getNativeUsdPrice } from "./nativePrice.js";

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

    const priced = await priceLpPair(chainId, address, token0 ? String(token0) : null, token1 ? String(token1) : null, provider);

    await db.pair.upsert({
      where: { chainId_address: { chainId, address } },
      create: {
        chainId,
        address,
        token0: token0 ? String(token0).toLowerCase() : null,
        token1: token1 ? String(token1).toLowerCase() : null,
        totalSupply: totalSupply === null ? null : String(totalSupply),
        reserveUsd: priced?.reserveUsd ?? null
      },
      update: {
        token0: token0 ? String(token0).toLowerCase() : undefined,
        token1: token1 ? String(token1).toLowerCase() : undefined,
        totalSupply: totalSupply === null ? undefined : String(totalSupply),
        reserveUsd: priced?.reserveUsd ?? undefined
      }
    });

    // Also persist the non-native side's own unit price, so a plain TOKEN-type
    // lock on the same underlying asset (no LP involved) still gets tvlUsd.
    if (priced?.otherToken) {
      await db.token.upsert({
        where: { chainId_address: { chainId, address: priced.otherToken } },
        create: { chainId, address: priced.otherToken, priceUsd: priced.tokenPriceUsd },
        update: { priceUsd: priced.tokenPriceUsd }
      });
    }
  }
}

/**
 * Prices a Uniswap V2-style LP pair by reserve ratio: if one side of the pool
 * is the chain's known wrapped-native token, the other side's price is
 * (nativeReserve / otherReserve) * nativeUsdPrice, and the pool's total USD
 * value is nativeReserveUsd * 2 (both sides of a constant-product pool hold
 * equal value). Returns null (never a guess) if neither side is a token we
 * can anchor a price to - most locker-created pairs will match one of the
 * canonical wrapped-native addresses, but arbitrary pairs may not.
 */
async function priceLpPair(
  chainId: number,
  pairAddress: string,
  token0: string | null,
  token1: string | null,
  provider: JsonRpcProvider
): Promise<{ reserveUsd: number; otherToken: string; tokenPriceUsd: number } | null> {
  const chain = chains.find((c) => c.id === chainId);
  if (!chain?.wrappedNativeAddress || !token0 || !token1) return null;

  const nativeAddr = chain.wrappedNativeAddress.toLowerCase();
  const isToken0Native = token0.toLowerCase() === nativeAddr;
  const isToken1Native = token1.toLowerCase() === nativeAddr;
  if (!isToken0Native && !isToken1Native) return null;

  const otherToken = (isToken0Native ? token1 : token0).toLowerCase();

  try {
    const pair = new Contract(pairAddress, pairAbi, provider);
    const [reserve0, reserve1] = await pair.getReserves();
    const nativeReserve = isToken0Native ? reserve0 : reserve1;
    const otherReserve = isToken0Native ? reserve1 : reserve0;
    if (nativeReserve === 0n || otherReserve === 0n) return null;

    const nativeUsdPrice = await getNativeUsdPrice(chain.symbol);
    if (!nativeUsdPrice) return null;

    const otherTokenContract = new Contract(otherToken, erc20Abi, provider);
    const otherDecimals = await otherTokenContract.decimals().catch(() => 18);

    const nativeReserveFormatted = Number(formatUnits(nativeReserve, 18));
    const otherReserveFormatted = Number(formatUnits(otherReserve, Number(otherDecimals)));
    if (otherReserveFormatted <= 0) return null;

    const tokenPriceUsd = (nativeReserveFormatted / otherReserveFormatted) * nativeUsdPrice;
    const reserveUsd = nativeReserveFormatted * nativeUsdPrice * 2;
    return { reserveUsd, otherToken, tokenPriceUsd };
  } catch {
    return null;
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
