# Warning Badges

Warnings are shown when:

- Lock duration is less than 30 days
- Less than 60% of LP/token supply is locked
- Main locker contract ownership is not renounced
- Token has a mint function
- Token has high tax
- Token owner can blacklist wallets

Do not show a warning for LP not being burned or LP not being permanently locked.

If a lock is permanent, show a positive badge: `Permanently Locked`.
