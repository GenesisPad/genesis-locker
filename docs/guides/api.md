# Genesis Locker API

Base URL: `https://locker.genesispad.app/api/v1`

The general API is public and read-only. Dedicated partner routes require an API key. Token amounts and USD values are strings so integrations do not lose precision.

## Liquidity-lock integrations

### List liquidity locks

`GET /liquidity-locks?chainId=4663&limit=100`

This feed is intended for DEX listings, market-data services, explorers, and bots. It returns active liquidity-token locks and locked V3 positions. Records include:

- network and pool address
- lock type
- whether the liquidity is currently locked
- locked amount and percentage when available
- unlock date or permanent status
- estimated USD value
- owner and beneficiary
- lock transaction and block-explorer link

### Check one pool

`GET /pools/:chainId/:poolAddress/locks`

Use this endpoint when displaying one trading pair. It returns combined lock status, value, percentage, latest unlock date, and individual lock records for that pool.

## General endpoints

- `GET /chains`
- `GET /stats`
- `GET /stats/tvl`
- `GET /stats/fees`
- `GET /locks?limit=20&assetType=token`
- `GET /positions?limit=20`
- `GET /locks/:chainId/:lockId`
- `GET /locks/:chainId/:contractAddress/:lockId`
- `GET /tokens/:chainId/:tokenAddress/locks`
- `GET /lp/:chainId/:lpAddress/status`
- `GET /wallets/:chainId/:walletAddress/locks`
- `GET /check/:chainId/:assetAddress`
- `GET /search?q=GEN`

The earlier `/v1` URLs remain available for existing integrations.

Prices and TVL refresh every five minutes. New transactions normally appear within a few minutes.

## Partner API

DEX listings and market-data partners should use the authenticated address endpoints rather than repeatedly downloading the public list:

- `GET /partner/tokens/:chainId/:tokenAddress/locks`
- `GET /partner/pools/:chainId/:poolAddress/locks`
- `GET /partner/liquidity-lock-events?chainId=4663&limit=100&cursor=...`

Send the credential as `X-API-Key: <key>` or `Authorization: Bearer <key>`. Partner responses are cached by the API for 15 seconds and include `ETag`, `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`. A quota response uses HTTP `429` and includes `Retry-After`.

The change feed is ordered by blockchain block and log position. Follow `nextCursor` while `hasMore` is true, then retain the cursor for the next check. The maximum page size is 500. `syncedThroughBlock` reports the latest block safely indexed across the chain's configured locker contracts.
