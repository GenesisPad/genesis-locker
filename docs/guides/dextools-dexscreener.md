# DEXTools and DexScreener Integration Guide

DEX data platforms can call the universal check endpoint for pair pages and token pages:

```text
GET /api/v1/liquidity-locks?chainId=:chainId&limit=100
GET /api/v1/pools/:chainId/:poolAddress/locks
GET /api/v1/check/:chainId/:assetAddress
```

Recommended display fields:

- Locked percentage
- Total locked amount
- Longest unlock date
- Permanent lock badge
- Short lock and low lock percentage warnings
- Contract ownership renouncement status
- Mint, high tax, and blacklist risk signals
