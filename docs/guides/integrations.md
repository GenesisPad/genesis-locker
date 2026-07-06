# Public Integration Guide

Integrators can use `GET /v1/check/:chainId/:assetAddress` for a universal token or LP lock status response.

Use `GET /v1/search?q=` when the user may enter a token address, LP/pair address, wallet address, token symbol, or token name.

Responses include lock status, permanent lock status, lock percentages, warning badges, and lock history.
