# Community Multisig

Genesis Locker uses a community multisig recipient for the community share of protocol fees.

The multisig is intended to fund:

- Contributor grants
- Public documentation
- API, frontend, and indexer infrastructure
- Security reviews and audits
- Integrations with wallets, explorers, DEX tools, and community dashboards

The multisig address and signer list should be published before mainnet launch. Until it is published, deployments should use a temporary recipient only for testing.

Recommended rules:

- Use a public Safe or equivalent multisig
- Require more than one signer for every payment
- Avoid founder-only control of the community treasury
- Publish monthly incoming fees, outgoing grants, and remaining balances
- Keep grant decisions and payment reasons visible to contributors
