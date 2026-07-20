# DEXTools and DexScreener Integration Guide

DEX data platforms receive a dedicated API key and query by the address already shown on their token or pair page:

```text
GET /api/v1/partner/tokens/:chainId/:tokenAddress/locks
GET /api/v1/partner/pools/:chainId/:poolAddress/locks
```

Send `X-API-Key: <key>` with each request. Partners that maintain a local index can additionally consume:

```text
GET /api/v1/partner/liquidity-lock-events?chainId=:chainId&limit=500&cursor=:nextCursor
```

Address lookups are the source of truth for display. The incremental feed only tells an integration which token or pool changed so it can refresh the relevant address.

Recommended display fields:

- Locked percentage
- Total locked amount
- Longest unlock date
- Permanent lock badge
- Short lock and low lock percentage warnings
- Contract ownership renouncement status
- Mint, high tax, and blacklist risk signals
