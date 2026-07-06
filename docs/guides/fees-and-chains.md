# Fees and Supported Chains

Genesis Locker deploys a separate locker contract per chain with configurable creation fees. Fees are set at deployment and can be changed only by the contract owner within the published maximum fee cap.

| Chain | Fee |
| --- | --- |
| Robinhood Chain (primary) | 0.01 ETH |
| Ethereum | 0.01 ETH |
| Base | 0.01 ETH |
| BSC | 0.03 BNB |

Collected fees are split 20% to the founder recipient and 80% to the community multisig recipient. The founder share is capped at deployment so ownership cannot later increase it above the published maximum.

The minimum contract-enforced duration is seven days. Locks under 30 days are allowed but shown as `Short Lock` warnings.
