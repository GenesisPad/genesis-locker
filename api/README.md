# Genesis Locker API

Public, read-only lock and TVL data for websites, bots, dashboards, explorers, and DEX integrations.

Production base URL: `https://locker.genesispad.app/api/v1`

## Endpoints

- `GET /chains`
- `GET /stats`
- `GET /stats/tvl`
- `GET /stats/fees`
- `GET /locks/:chainId/:lockId`
- `GET /locks/:chainId/:contractAddress/:lockId`
- `GET /locks`
- `GET /positions`
- `GET /liquidity-locks`
- `GET /pools/:chainId/:poolAddress/locks`
- `GET /my-locks/:chainId/:walletAddress`
- `GET /tokens/:chainId/:tokenAddress/locks`
- `GET /lp/:chainId/:lpAddress/status`
- `GET /wallets/:chainId/:walletAddress/locks`
- `GET /check/:chainId/:assetAddress`
- `GET /search?q=`
- `GET /search/token/:chainId/:tokenAddress`
- `GET /search/pair/:chainId/:pairAddress`
- `GET /search/wallet/:chainId/:walletAddress`

## Liquidity partners

Use `GET /liquidity-locks?chainId=4663&limit=100` for a current public feed of active liquidity locks. Use `GET /pools/:chainId/:poolAddress/locks` to check one pool. Both routes expose the locked amount, percentage when available, unlock date, permanent status, USD value, and transaction proof.

DEX and market-data partners should use the authenticated `/partner` routes. Issue partner credentials from Genesis Sentinel's admin panel, then set Locker's `PARTNER_API_KEYS` secret to the same raw values in `partner-name:<key>` format.

The earlier `/v1` URLs remain available for existing integrations.

## Warning policy

Warnings are exposed for short locks under 30 days, lock percentages below 60%, contract ownership not renounced, mint risk, high tax risk, and blacklist risk. Permanent locks are shown as positive proof, not a requirement.

## Running locally

Run `npm run seed` to add the configured networks and contracts, then run `npm run index` to import the latest on-chain lock activity.
