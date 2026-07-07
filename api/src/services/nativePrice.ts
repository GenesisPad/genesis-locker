// Fetches native-currency USD prices (ETH, BNB) with no API key required, using
// the same free waterfall GenesisPad's own app uses: Coinbase -> Binance ->
// CoinGecko. Cached for 60s per symbol so we don't hammer any one source.

const CACHE_MS = 60_000;
const cache = new Map<string, { usd: number; timestamp: number }>();

const SOURCES: Record<string, Array<{ url: string; read: (payload: any) => number }>> = {
  ETH: [
    { url: "https://api.coinbase.com/v2/exchange-rates?currency=ETH", read: (p) => Number(p?.data?.rates?.USD) },
    { url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", read: (p) => Number(p?.price) },
    { url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", read: (p) => Number(p?.ethereum?.usd) },
  ],
  BNB: [
    { url: "https://api.coinbase.com/v2/exchange-rates?currency=BNB", read: (p) => Number(p?.data?.rates?.USD) },
    { url: "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT", read: (p) => Number(p?.price) },
    { url: "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd", read: (p) => Number(p?.binancecoin?.usd) },
  ],
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Returns the USD price of a chain's native currency (e.g. "ETH", "BNB"), or null if every source failed. */
export async function getNativeUsdPrice(symbol: string): Promise<number | null> {
  const key = symbol.toUpperCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_MS) {
    return cached.usd;
  }

  const sources = SOURCES[key];
  if (!sources) return cached?.usd ?? null;

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) continue;
      const payload = await response.json();
      const usd = source.read(payload);
      if (isPositiveNumber(usd)) {
        cache.set(key, { usd, timestamp: Date.now() });
        return usd;
      }
    } catch {
      // Try the next source.
    }
  }

  return cached?.usd ?? null;
}
