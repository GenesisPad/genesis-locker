# API Documentation

Base path: `/v1`

## Endpoints

- `GET /chains`
- `GET /stats`
- `GET /stats/tvl`
- `GET /stats/fees`
- `GET /locks/:chainId/:lockId`
- `GET /tokens/:chainId/:tokenAddress/locks`
- `GET /lp/:chainId/:lpAddress/status`
- `GET /wallets/:chainId/:walletAddress/locks`
- `GET /check/:chainId/:assetAddress`
- `GET /search?q=`
- `GET /search/token/:chainId/:tokenAddress`
- `GET /search/pair/:chainId/:pairAddress`
- `GET /search/wallet/:chainId/:walletAddress`

## Universal Check Response

```json
{
  "chainId": 8453,
  "assetAddress": "0x...",
  "assetType": "lp",
  "isLocked": true,
  "hasPermanentLock": true,
  "totalLockedAmount": "5000000000000000000",
  "lockedPercentage": "72.8",
  "longestUnlockDate": "2027-01-01",
  "locks": [
    {
      "lockId": 12,
      "amount": "3000000000000000000",
      "unlockDate": null,
      "isPermanent": true,
      "lockType": "permanent"
    }
  ]
}
```
