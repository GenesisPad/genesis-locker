# Permanent Locks

When a lock owner calls `permanentLock(lockId)`, withdrawal rights are renounced forever. Nobody can withdraw that lock afterward, and the LP/token remains in the locker contract forever.

Use the labels `Permanently Locked` and `Withdrawal Rights Renounced`. Avoid language like `LP ownership renounced` because it can confuse users.
