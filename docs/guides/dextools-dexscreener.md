# DEXTools and DexScreener Integration Guide

DEX data platforms can call the universal check endpoint for pair pages and token pages:

```text
GET /v1/check/:chainId/:assetAddress
GET /v1/lp/:chainId/:lpAddress/status
GET /v1/tokens/:chainId/:tokenAddress/locks
```

Recommended display fields:

- Locked percentage
- Total locked amount
- Longest unlock date
- Permanent lock badge
- Short lock and low lock percentage warnings
- Contract ownership renouncement status
- Mint, high tax, and blacklist risk signals
