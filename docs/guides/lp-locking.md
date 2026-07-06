# LP Locking

LP tokens are ERC20-compatible assets issued by decentralized exchange pairs or pools. Genesis Locker stores LP locks with `isLpToken = true` so API consumers and the frontend can distinguish liquidity locks from ordinary token locks.

Users can create LP locks, extend duration, add more LP tokens, transfer lock ownership, or permanently renounce withdrawal rights.

Genesis Locker does not warn merely because LP tokens are not burned or not permanently locked.
