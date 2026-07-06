# Decentralization and Ownership Renouncement Policy

Genesis Locker may use a creator fee, but the main locker contract should be operated with narrow owner powers and public reporting.

The API should expose whether locker ownership is renounced. If ownership is not renounced, show `Contract Ownership Not Renounced` as a warning badge.

The locker contract does not include a pause function. Lock creation and withdrawals should remain governed by the contract rules even while ownership exists.

Owner powers are limited to fee configuration:

- Update the lock creation fee within the deployment-time maximum fee cap
- Update founder and community fee recipient addresses
- Lower or update the founder fee share within the deployment-time maximum founder share cap

If ownership is renounced, these settings become fixed. If ownership is not renounced, users should treat the remaining configuration rights as a governance risk and verify the published fee caps, recipients, and split before locking assets.
