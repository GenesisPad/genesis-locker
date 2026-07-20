# DEXTools and DexScreener Integration Guide

DEX data platforms receive a dedicated API key and query by the address already shown on their token or pair page. Genesis Sentinel is the source of partner credentials: generate the key in the Sentinel admin panel, then store the same raw value in Genesis Locker's `PARTNER_API_KEYS` secret as `partner-name:<key>`.

```text
GET /api/v1/partner/tokens/:chainId/:tokenAddress/locks
GET /api/v1/partner/pools/:chainId/:poolAddress/locks
```

Send `X-API-Key: <key>` or `Authorization: Bearer <key>` with each request. Partners that maintain a local index can additionally consume:

```text
GET /api/v1/partner/liquidity-lock-events?chainId=:chainId&limit=500&cursor=:nextCursor
```

Address lookups are the source of truth for display. The incremental feed only tells an integration which token or pool changed so it can refresh the relevant address.

Do not configure `PARTNER_API_KEYS` in Genesis Sentinel. Sentinel stores generated keys in its own database and uses Locker's secret only by sharing the same raw key values at issuance time.

Recommended display fields:

- Locked percentage
- Total locked amount
- Longest unlock date
- Permanent lock badge
- Short lock and low lock percentage warnings
- Contract ownership renouncement status
- Mint, high tax, and blacklist risk signals
