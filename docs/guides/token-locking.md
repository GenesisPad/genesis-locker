# Token Locking

Token locks work with ERC20/BEP20-compatible assets. Genesis Locker stores token locks with `isLpToken = false`.

Token locks can be cliff locks, vesting locks, or permanent locks. The contract blocks zero amount locks, zero address tokens, and lock durations under seven days.
