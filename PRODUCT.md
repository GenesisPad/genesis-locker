# Product

## Register

product

## Users

Token and LP holders on Robinhood Chain (primary), Ethereum, Base, and BNB Chain who need to prove they've locked liquidity or team tokens - project founders building trust with their community, and the community members, bots (DEXTools, DexScreener), and explorers who verify those locks. Users arrive either to *create* a lock (connected wallet, filling forms, paying gas) or to *verify* someone else's lock (public proof pages, no wallet required). Both paths must feel equally solid: creators are trusting the contract with real assets, verifiers are making trust decisions based on what they see.

## Product Purpose

Genesis Locker is decentralized proof infrastructure for token and LP locking. It locks tokens on-chain (cliff or vesting schedules, permanent option), then surfaces that proof publicly: lock pages, chain-wide stats, wallet-level views, and an API for third-party integrations. It does not endorse projects or guarantee safety - it proves what is verifiably true on-chain (locked amount, duration, ownership renouncement) and flags what its analysis can detect (mint risk, high tax, blacklist functions). Success looks like: a project can point to a Genesis Locker page as unambiguous proof, and a stranger can understand that proof in seconds without needing to read Solidity.

## Brand Personality

Trustworthy, premium, transparent. This is a vault, not a casino - confidence expressed through restraint and precision (dark base, gold used deliberately, not everywhere), not through hype or urgency. Copy is plain and factual ("Ownership Renounced", "Locked until Dec 31, 2026"), never salesy. The gold accent signals value and permanence; it should read as a bank vault door, not a slot machine.

## Anti-references

Explicitly avoid the generic DeFi-dashboard template: purple/violet gradients, glassmorphism cards, neon glows on every surface, identical stat-card grids repeated without hierarchy, and cluttered chain-icon soup. Genesis Locker should look like it was designed once, deliberately, not assembled from a Uniswap-fork starter kit. Also avoid corporate-fintech sterility (no navy-and-white bank-app coldness) - it should still feel crypto-native, just the premium/serious end of crypto rather than the meme end.

## Design Principles

1. **Gold is a signal, not a wash.** Reserve the gold accent for things that matter - primary actions, the locked/renounced state, the active nav item. If everything glows gold, nothing does.
2. **Numbers are the product.** Locked amounts, unlock dates, percentages, and fees are what users came for - typography and layout should make these the most legible thing on every screen, not decoration competing with them.
3. **Proof over persuasion.** No marketing filler, no vague reassurance copy. State what's true on-chain plainly; let the facts carry the trust.
4. **One primary action per screen.** Create Lock, Connect Wallet, Withdraw - each screen should make the one correct next action obvious, everything else recedes.
5. **Consistency across chains.** Robinhood Chain is primary, but the same lock card, the same stat layout, the same trust badges must work identically whether the chain is Robinhood, Ethereum, Base, or BSC.

## Accessibility & Inclusion

Standard WCAG AA baseline: sufficient contrast on dark backgrounds, full keyboard navigation, visible focus states, and respect for `prefers-reduced-motion`. Risk/status badges (Mint Risk, Blacklist Risk, Ownership Renounced, etc.) must not rely on color alone - pair every color-coded state with an icon or label so they remain legible for colorblind users.
