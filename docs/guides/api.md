# Genesis Locker API

Base URL: `https://locker.genesispad.app`

The API is public, read-only, and does not require an API key. Token amounts and USD values are strings so integrations do not lose precision.

## Liquidity-lock integrations

### List liquidity locks

`GET /v1/liquidity-locks?chainId=4663&limit=100`

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

`GET /v1/pools/:chainId/:poolAddress/locks`

Use this endpoint when displaying one trading pair. It returns combined lock status, value, percentage, latest unlock date, and individual lock records for that pool.

## General endpoints

- `GET /v1/chains`
- `GET /v1/stats`
- `GET /v1/stats/tvl`
- `GET /v1/stats/fees`
- `GET /v1/locks?limit=20&assetType=token`
- `GET /v1/positions?limit=20`
- `GET /v1/locks/:chainId/:lockId`
- `GET /v1/locks/:chainId/:contractAddress/:lockId`
- `GET /v1/tokens/:chainId/:tokenAddress/locks`
- `GET /v1/lp/:chainId/:lpAddress/status`
- `GET /v1/wallets/:chainId/:walletAddress/locks`
- `GET /v1/check/:chainId/:assetAddress`
- `GET /v1/search?q=GEN`

Prices and TVL refresh every five minutes. New transactions normally appear within a few minutes.
