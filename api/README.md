# Genesis Locker API

Public API and event indexer for Genesis Locker.

## Endpoints

- `GET /v1/chains`
- `GET /v1/stats`
- `GET /v1/stats/tvl`
- `GET /v1/stats/fees`
- `GET /v1/locks/:chainId/:lockId`
- `GET /v1/tokens/:chainId/:tokenAddress/locks`
- `GET /v1/lp/:chainId/:lpAddress/status`
- `GET /v1/wallets/:chainId/:walletAddress/locks`
- `GET /v1/check/:chainId/:assetAddress`
- `GET /v1/search?q=`
- `GET /v1/search/token/:chainId/:tokenAddress`
- `GET /v1/search/pair/:chainId/:pairAddress`
- `GET /v1/search/wallet/:chainId/:walletAddress`

## Warning Policy

Warnings are exposed for short locks under 30 days, lock percentages below 60%, contract ownership not renounced, mint risk, high tax risk, and blacklist risk. Permanent locks are shown as positive proof, not a requirement.

## Indexing

Run `npm run seed` to persist configured chains and contracts, then `npm run index` to scan configured locker contracts. The indexer stores a per-chain/contract block cursor and applies every Genesis Locker event to lock state.
