# Genesis Locker Contract Gap Audit, 2026-07-14

Reviewed:

- Memo Bank, Genesis-Locker recent entries
- Memo Bank, GenesisPad recent entries
- `contracts/contracts/GenesisLocker.sol`
- `contracts/contracts/GenesisV3PositionLocker.sol`
- `contracts/contracts/GenesisLockerRegistry.sol`
- `api/prisma/schema.prisma`
- `api/src/indexer/reducer.ts`
- `api/src/routes/index.ts`
- `frontend/src/pages/CreateLock.tsx`
- `frontend/src/pages/LockDetail.tsx`

## Supported Today

| Requirement | Status | Evidence |
| --- | --- | --- |
| ERC20 timed locks | Supported | `GenesisLocker.createCliffLock(..., isLpToken=false)` |
| ERC20 permanent locks | Supported | create cliff lock, then `GenesisLocker.permanentLock(lockId)` |
| ERC20 vesting | Supported | `GenesisLocker.createVestingLock(..., isLpToken=false)` |
| V2 LP timed locks | Supported | `GenesisLocker.createCliffLock(..., isLpToken=true)` |
| V2 LP permanent locks | Supported | create cliff lock, then `GenesisLocker.permanentLock(lockId)` |
| GenesisPad automated V3 lock registration | Supported for permanent launch positions | `GenesisV3PositionLocker.lockGenesisLaunchPosition(...)` plus optional registry reporting |
| Permanent V3 no-withdrawal invariant | Supported | `GenesisV3PositionLocker` has no withdraw, transfer, approve, decrease-liquidity, migrate or registered-position rescue path |
| V3 fee collection while locked | Supported for active fee distributor only | `GenesisV3PositionLocker.collectFees(...)` and liquidity invariant check |

## Gaps

| Requirement | Gap Type | Notes |
| --- | --- | --- |
| Independent/manual V3 timed locks | Contract, SDK, API/indexer, frontend | Current V3 locker accepts only launch-factory deposits and always records permanent launch positions. |
| Independent/manual V3 permanent locks | Contract, SDK, API/indexer, frontend | Current permanent V3 flow is GenesisPad-launch-only, not user-submitted NFT locking. |
| Independent V3 fee recipient | Contract, SDK, API/indexer, frontend | Current fee recipient is the active fee distributor, not a per-lock user-selected recipient. |
| V3 NFT withdrawal after timed expiry | Contract, SDK, API/indexer, frontend | There are no V3 timed locks and no withdrawal function. |
| Wallet-owned V3 position discovery | API/backend, SDK, frontend | Needed only when independent V3 locking is implemented. |
| V3 accrued fee quoting by token | API/indexer | Fee collection events are indexed, but live uncollected fee quoting is not yet exposed. |
| GenesisPad launch fee policy display from indexed policy | API/indexer, frontend | Fee policy should come from indexed GenesisPad launch state; do not hardcode percentages. |

## Product Boundary Implemented

The frontend exposes Genesis Locker as one product. Manual create flow supports only current contract-backed ERC20 and V2 LP lock categories. V3 positions are displayed and proven when indexed from GenesisPad launch locks, but independent/manual V3 locking is intentionally marked as unavailable until contract support exists.
