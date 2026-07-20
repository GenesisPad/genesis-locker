# Public Integration Guide

Integrators can use `GET /api/v1/check/:chainId/:assetAddress` for a universal token or liquidity-token lock status response. Use `GET /api/v1/pools/:chainId/:poolAddress/locks` for a trading pair or `GET /api/v1/liquidity-locks` for the complete liquidity-lock feed.

Use `GET /api/v1/search?q=` when the user may enter a token address, pool address, wallet address, token symbol, or token name.

Responses include lock status, permanent lock status, lock percentages, warning badges, and lock history.
