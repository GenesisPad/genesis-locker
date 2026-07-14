import { AssetType } from "@prisma/client";
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits } from "ethers";
import { db } from "../db.js";
import { erc20Abi, pairAbi, factoryAbi, genesisLockerAbi } from "../contracts/genesisLockerAbi.js";
import { chains } from "../config.js";
import { getNativeUsdPrice } from "./nativePrice.js";

const mintSelectors = ["40c10f19", "6a627842"];
const blacklistSelectors = ["f9f92be4", "4ef4c3e1", "8f32d59b", "c4d66de8"];

function codeContainsAny(code: string, selectors: string[]) {
  const lower = code.toLowerCase();
  return selectors.some((selector) => lower.includes(selector));
}

// There is no reliable way to detect an actual buy/sell tax percentage from
// bytecode alone - the previous selector list included transfer(address,
// uint256) (0xa9059cbb, present on every ERC20) and transferOwnership
// (0xf2fde38b, present on every Ownable contract), which meant every single
// token was flagged "High Tax Risk" regardless of its real tax. Rather than
// guess, this always returns false until a real detection method (e.g.
// simulating a buy+sell through the token's actual pool) is implemented.
function hasHighTaxRisk(_code: string) {
  return false;
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
      hasHighTaxRisk: hasHighTaxRisk(code),
      hasBlacklistRisk: codeContainsAny(code, blacklistSelectors)
    },
    update: {
      name: name ? String(name) : undefined,
      symbol: symbol ? String(symbol) : undefined,
      decimals: decimals === null ? undefined : Number(decimals),
      totalSupply: totalSupply === null ? undefined : String(totalSupply),
      hasMintRisk: codeContainsAny(code, mintSelectors),
      hasHighTaxRisk: hasHighTaxRisk(code),
      hasBlacklistRisk: codeContainsAny(code, blacklistSelectors)
    }
  });

  await refreshAssetPrice(chainId, address, assetType, provider, totalSupply === null ? null : String(totalSupply));
}

/**
 * Just the pricing half of syncAssetMetadata, without the identity/bytecode
 * fetches (name, symbol, decimals, mint/tax/blacklist scan) - those rarely
 * change, so a frequent price-refresh job shouldn't redo them. Safe to call
 * on its own once a token/pair row already exists.
 */
export async function refreshAssetPrice(
  chainId: number,
  assetAddress: string,
  assetType: AssetType,
  provider: JsonRpcProvider,
  knownTotalSupply?: string | null
) {
  const address = assetAddress.toLowerCase();

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
        totalSupply: knownTotalSupply ?? null,
        reserveUsd: priced?.reserveUsd ?? null
      },
      update: {
        token0: token0 ? String(token0).toLowerCase() : undefined,
        token1: token1 ? String(token1).toLowerCase() : undefined,
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
  } else if (assetType === AssetType.TOKEN) {
    // Plain token lock, no LP lock involved: try to find the pair ourselves
    // via the chain's DEX factory (if configured) so this token can still get
    // priced without ever having had its LP locked on Genesis Locker. This
    // only succeeds once the token has an actual AMM pool (e.g. graduated
    // from a bonding-curve launcher), so it naturally returns null before
    // that and we fall back to the bonding curve's own live virtual reserves.
    const priced = (await priceTokenViaFactory(chainId, address, provider))
      ?? (await priceViaBondingCurve(chainId, address, provider));
    if (priced) {
      await db.token.update({
        where: { chainId_address: { chainId, address } },
        data: { priceUsd: priced.tokenPriceUsd }
      });
    }
  }
}

// Minimal read-only slice of GenesisPad's launcher TokenInfo struct getter -
// only the fields needed to derive a spot price from the bonding curve.
const launcherAbi = [
  "function data(address) view returns (address creator, bool tradingStarted, bool listed, bool whitelistOnly, bool lockLp, uint256 wlCount, uint256 totalSupply, uint256 ethRaised, uint256 tokensSold, uint256 virtualEthReserve, uint256 virtualTokenReserve, uint256 k, uint256 feeCollected, uint256 taxOnGnsBps, uint256 taxOnDexBps, bool isBundled, bool isTaxedOnDex, bool isTaxedOnGns, bool isMaxWalletOnGns, uint256 maxWalletAmountOnGns, address dexRouter)"
] as const;

/**
 * Prices a token still on GenesisPad's bonding curve using the same
 * marginal-price math as an AMM: virtualEthReserve / virtualTokenReserve
 * gives the current spot price in native currency, exactly like a Uniswap
 * V2 pool's reserve ratio (this is a constant-product curve, k =
 * virtualEthReserve * virtualTokenReserve, same shape as x*y=k pools).
 * Returns null once the token has "listed" (graduated) - its virtual
 * reserves freeze at graduation and are no longer the live market price.
 */
async function priceViaBondingCurve(
  chainId: number,
  tokenAddress: string,
  provider: JsonRpcProvider
): Promise<{ tokenPriceUsd: number } | null> {
  const chain = chains.find((c) => c.id === chainId);
  if (!chain?.launcherAddress) return null;

  try {
    const launcher = new Contract(chain.launcherAddress, launcherAbi, provider);
    const info = await launcher.data(tokenAddress);
    if (info.listed || info.virtualEthReserve === 0n || info.virtualTokenReserve === 0n) return null;

    const nativeUsdPrice = await getNativeUsdPrice(chain.symbol);
    if (!nativeUsdPrice) return null;

    const tokenContract = new Contract(tokenAddress, erc20Abi, provider);
    const decimals = Number(await tokenContract.decimals().catch(() => 18));
    const ethReserveFormatted = Number(formatUnits(info.virtualEthReserve, 18));
    const tokenReserveFormatted = Number(formatUnits(info.virtualTokenReserve, decimals));
    if (tokenReserveFormatted <= 0) return null;

    return { tokenPriceUsd: (ethReserveFormatted / tokenReserveFormatted) * nativeUsdPrice };
  } catch {
    return null;
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
  const priced = await priceByReserves(chainId, pairAddress, isToken0Native, otherToken, provider);
  return priced ? { ...priced, otherToken } : null;
}

/**
 * Plain-token equivalent of priceLpPair: when a token was locked on its own
 * (no LP lock involved), looks up its pair against the chain's wrapped-native
 * currency via the configured DEX factory, then prices it the same way. Only
 * runs when ROBINHOOD_DEX_FACTORY_ADDRESS (or the equivalent per-chain env
 * var) is set - returns null rather than guessing a factory address.
 */
async function priceTokenViaFactory(
  chainId: number,
  tokenAddress: string,
  provider: JsonRpcProvider
): Promise<{ reserveUsd: number; tokenPriceUsd: number } | null> {
  const chain = chains.find((c) => c.id === chainId);
  if (!chain?.wrappedNativeAddress || !chain.dexFactoryAddress) return null;

  try {
    const factory = new Contract(chain.dexFactoryAddress, factoryAbi, provider);
    const pairAddress = String(await factory.getPair(tokenAddress, chain.wrappedNativeAddress));
    if (!pairAddress || pairAddress === ZeroAddress) return null;

    const pair = new Contract(pairAddress, pairAbi, provider);
    const token0 = String(await pair.token0()).toLowerCase();
    const isToken0Native = token0 === chain.wrappedNativeAddress.toLowerCase();

    return priceByReserves(chainId, pairAddress, isToken0Native, tokenAddress, provider);
  } catch {
    return null;
  }
}

async function priceByReserves(
  chainId: number,
  pairAddress: string,
  isToken0Native: boolean,
  otherToken: string,
  provider: JsonRpcProvider
): Promise<{ reserveUsd: number; tokenPriceUsd: number } | null> {
  const chain = chains.find((c) => c.id === chainId);
  if (!chain) return null;

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
    return { reserveUsd, tokenPriceUsd };
  } catch {
    return null;
  }
}

export async function refreshAssetCalculations(chainId: number, assetAddress: string) {
  const address = assetAddress.toLowerCase();
  const locks = await db.lock.findMany({ where: { chainId, assetAddress: address } });
  const token = await db.token.findUnique({ where: { chainId_address: { chainId, address } } });
  const pair = await db.pair.findUnique({ where: { chainId_address: { chainId, address } } });
  const totalSupply = BigInt(pair?.totalSupply || token?.totalSupply || "0");

  // Each lock gets its OWN share of supply/value, not the asset's combined
  // total repeated across every row - a wallet holding two separate locks
  // of 1% and 35% of supply should show 1% and 35%, not 36% on both.
  for (const lock of locks) {
    const remaining = BigInt(lock.amount) - BigInt(lock.withdrawnAmount);
    const lockedPercentage = totalSupply > 0n ? Number((remaining * 100_000n) / totalSupply) / 1000 : null;

    let tvlUsd: number | null = null;
    if (pair?.reserveUsd && totalSupply > 0n) {
      tvlUsd = (Number(remaining) / Number(totalSupply)) * Number(pair.reserveUsd);
    } else if (token?.priceUsd) {
      const decimals = token.decimals ?? 18;
      tvlUsd = (Number(remaining) / 10 ** decimals) * Number(token.priceUsd);
    }

    await db.lock.update({
      where: { id: lock.id },
      data: { lockedPercentage, tvlUsd }
    });
  }
}

export async function refreshV3PositionLockValue(lockDbId: string) {
  const lock = await db.lock.findUnique({ where: { id: lockDbId } });
  if (!lock || lock.assetType !== AssetType.V3_POSITION) return;
  const chain = chains.find((item) => item.id === lock.chainId);
  const wrappedNative = chain?.wrappedNativeAddress?.toLowerCase();
  const candidates = Array.from(new Set([
    lock.launchTokenAddress?.toLowerCase(),
    lock.pairedAssetAddress?.toLowerCase(),
    lock.assetAddress?.toLowerCase()
  ].filter(Boolean) as string[]));
  const poolAddress = lock.poolAddress?.toLowerCase();
  if (!candidates.length || !poolAddress) return;

  try {
    const payloads = await Promise.all(candidates.map(async (tokenAddress) => {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
        headers: {
          accept: "application/json",
          "user-agent": "GenesisLocker/1.0 (+https://locker.genesispad.app)"
        }
      });
      if (!response.ok) return null;
      return response.json() as Promise<{
        pairs?: Array<{
          pairAddress?: string;
          liquidity?: { usd?: number | string };
          baseToken?: { address?: string };
          quoteToken?: { address?: string };
        }>;
      }>;
    }));
    const pair = payloads
      .flatMap((payload) => payload?.pairs ?? [])
      .find((item) => item.pairAddress?.toLowerCase() === poolAddress);
    const value = Number(pair?.liquidity?.usd ?? 0);
    if (!Number.isFinite(value) || value <= 0) return;
    const base = pair?.baseToken?.address?.toLowerCase();
    const quote = pair?.quoteToken?.address?.toLowerCase();
    const publicToken = base && base !== wrappedNative ? base : quote && quote !== wrappedNative ? quote : undefined;
    if (publicToken) {
      await db.token.upsert({
        where: { chainId_address: { chainId: lock.chainId, address: publicToken } },
        create: { chainId: lock.chainId, address: publicToken },
        update: {}
      });
    }
    await db.lock.update({
      where: { id: lock.id },
      data: {
        tvlUsd: value,
        ...(publicToken ? { assetAddress: publicToken, launchTokenAddress: publicToken } : {})
      }
    });
    if (publicToken && chain) {
      await syncAssetMetadata(lock.chainId, publicToken, AssetType.TOKEN, new JsonRpcProvider(chain.rpcUrl)).catch(() => undefined);
    }
  } catch {
    // Price lookups are best-effort. The lock proof remains valid without a USD estimate.
  }
}
