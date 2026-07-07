# Public Fee Policy

Genesis Locker charges a native-token fee when a user creates a lock.

Initial fees (and the maximum cap the owner can never exceed, fixed at deployment):

| Chain | Creation fee | Max fee cap |
| --- | --- | --- |
| Robinhood Chain (primary) | 0.01 ETH | 0.1 ETH |
| Ethereum | 0.01 ETH | 0.1 ETH |
| Base | 0.01 ETH | 0.1 ETH |
| BSC | 0.03 BNB | 0.3 BNB |

Fee distribution:

| Recipient | Share | Purpose |
| --- | ---: | --- |
| Founder recipient | 20% | Founder/operator revenue |
| Community multisig | 80% | Contributor grants, infrastructure, audits, docs, integrations, and community work |

The fee is distributed immediately during lock creation. The locker contract should not hold fee balances during normal operation.

Fees are configurable by the owner before ownership renouncement, but only within the maximum fee cap set at deployment. The founder share is also capped at deployment so it cannot be increased beyond the published maximum.

Fee changes should be announced before they are made and recorded in the next monthly treasury report.
