# Genesis Locker API

Public, read-only lock and TVL data for websites, bots, dashboards, explorers, and DEX integrations.

Production base URL: `https://locker.genesispad.app`

## Endpoints

- `GET /v1/chains`
- `GET /v1/stats`
- `GET /v1/stats/tvl`
- `GET /v1/stats/fees`
- `GET /v1/locks/:chainId/:lockId`
- `GET /v1/locks/:chainId/:contractAddress/:lockId`
- `GET /v1/locks`
- `GET /v1/positions`
- `GET /v1/liquidity-locks`
- `GET /v1/pools/:chainId/:poolAddress/locks`
- `GET /v1/my-locks/:chainId/:walletAddress`
- `GET /v1/tokens/:chainId/:tokenAddress/locks`
- `GET /v1/lp/:chainId/:lpAddress/status`
- `GET /v1/wallets/:chainId/:walletAddress/locks`
- `GET /v1/check/:chainId/:assetAddress`
- `GET /v1/search?q=`
- `GET /v1/search/token/:chainId/:tokenAddress`
- `GET /v1/search/pair/:chainId/:pairAddress`
- `GET /v1/search/wallet/:chainId/:walletAddress`

## Liquidity partners

Use `GET /v1/liquidity-locks?chainId=4663&limit=100` for a current feed of active liquidity locks. Use `GET /v1/pools/:chainId/:poolAddress/locks` to check one pool. Both routes expose the locked amount, percentage when available, unlock date, permanent status, USD value, and transaction proof.

## Warning policy

Warnings are exposed for short locks under 30 days, lock percentages below 60%, contract ownership not renounced, mint risk, high tax risk, and blacklist risk. Permanent locks are shown as positive proof, not a requirement.

## Running locally

Run `npm run seed` to add the configured networks and contracts, then run `npm run index` to import the latest on-chain lock activity.
