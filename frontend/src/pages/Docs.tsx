import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Coins, Lock, Search, ShieldCheck, Smartphone } from 'lucide-react'

type Guide = {
  icon: typeof Lock
  title: string
  summary: string
  sections: Array<{ heading: string; body: string; steps?: string[] }>
  note?: string
}

const GUIDES: Guide[] = [
  {
    icon: BookOpen,
    title: 'Start here',
    summary: 'Genesis Locker lets anyone lock tokens or liquidity and share a public record of the lock.',
    sections: [
      {
        heading: 'What the locker shows',
        body: 'Every lock page shows the asset, owner, beneficiary, amount, unlock date, transaction history, and estimated USD value when pricing is available. Permanent liquidity positions created through GenesisPad are included too.',
      },
      {
        heading: 'What a lock does not prove',
        body: 'A lock proves that the displayed assets cannot be withdrawn before the stated date, subject to the contract rules. It is not an endorsement of the token, its team, or its future value.',
      },
      {
        heading: 'Supported networks',
        body: 'The app supports Robinhood Chain, Ethereum, Base, and BNB Chain. Available contracts and fees are shown after you select a network.',
      },
    ],
    note: 'Always confirm the token address, network, amount, and unlock date before relying on a lock.',
  },
  {
    icon: Lock,
    title: 'Create a lock',
    summary: 'Choose an asset, set who receives it, and decide when it becomes available.',
    sections: [
      {
        heading: 'Before you begin',
        body: 'Keep enough native currency in your wallet for the locker fee and network fee. Token and liquidity-token locks also require an approval transaction before the lock transaction.',
      },
      {
        heading: 'Create the lock',
        body: 'The form checks the asset on the selected network and shows a summary before you sign.',
        steps: [
          'Connect your wallet and choose the correct network.',
          'Enter the token or liquidity-token contract address.',
          'Choose a timed unlock, vesting schedule, or permanent lock.',
          'Enter the beneficiary who will receive unlocked assets.',
          'Review the amount, dates, and fee, then approve and confirm in your wallet.',
        ],
      },
      {
        heading: 'After confirmation',
        body: 'Your public lock page normally appears within a few minutes. You can copy that page and share it with your community.',
      },
    ],
  },
  {
    icon: Coins,
    title: 'Lock types',
    summary: 'Use the schedule that matches how the assets should become available.',
    sections: [
      {
        heading: 'Timed lock',
        body: 'The full remaining amount becomes available to the beneficiary on the unlock date. The minimum duration is seven days.',
      },
      {
        heading: 'Vesting lock',
        body: 'Tokens become available gradually after the cliff date. The vesting interval controls how often another portion can be claimed.',
      },
      {
        heading: 'Permanent lock',
        body: 'Withdrawal rights are given up permanently. GenesisPad launch liquidity positions use this type of lock. Trading fees may still be collected according to the position locker rules.',
      },
      {
        heading: 'Extending a lock',
        body: 'A lock owner can move the end date later, add more tokens, or make an eligible lock permanent. The end date cannot be shortened.',
      },
    ],
  },
  {
    icon: Search,
    title: 'Verify a lock',
    summary: 'Search by token, pool, wallet, position number, or lock number.',
    sections: [
      {
        heading: 'Read the public page',
        body: 'Check the network and contract address first. Then review the remaining locked amount, beneficiary, unlock schedule, permanent-lock status, and the transaction links.',
      },
      {
        heading: 'USD values and TVL',
        body: 'USD values are estimates based on current token prices and pool liquidity. They refresh every five minutes. TVL is the sum of priced token locks, liquidity-token locks, and locked liquidity positions. Unpriced assets are shown as unavailable and are not guessed.',
      },
      {
        heading: 'Warnings',
        body: 'Warnings call attention to facts such as a short duration, a low percentage of supply locked, or supported token risks. They are prompts for further research, not a safety score.',
      },
    ],
  },
  {
    icon: Smartphone,
    title: 'Wallets and mobile',
    summary: 'Use a browser wallet on desktop or open the connection in a supported mobile wallet.',
    sections: [
      {
        heading: 'Supported connections',
        body: 'Genesis Locker supports installed browser wallets, MetaMask, Rainbow, Trust Wallet, Coinbase Wallet, and WalletConnect-compatible wallets.',
      },
      {
        heading: 'Connect from a phone',
        body: 'Tap Connect Wallet and choose your wallet. The app opens the wallet when a direct mobile connection is available. You can also choose WalletConnect and approve the request from the wallet app.',
      },
      {
        heading: 'If the wrong network is selected',
        body: 'Choose the intended network in Genesis Locker and approve the network switch in your wallet. Never approve a transaction if the wallet shows a different asset, amount, or network than the review screen.',
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Safety',
    summary: 'A few checks make public lock records much easier to trust.',
    sections: [
      {
        heading: 'Verify addresses',
        body: 'Use the block-explorer links on the lock page. Compare the token address with the address published by the project through a separate trusted channel.',
      },
      {
        heading: 'Protect your wallet',
        body: 'Genesis Locker never needs your seed phrase or private key. Wallet prompts should only request a connection, token approval, network switch, or the transaction you started.',
      },
      {
        heading: 'Understand the limit of a lock',
        body: 'Locked liquidity can reduce one kind of risk, but token permissions, supply changes, transfer rules, pricing, and project operations can still affect holders.',
      },
    ],
  },
  {
    icon: Search,
    title: 'DEX integrations',
    summary: 'Public endpoints make liquidity-lock status available to listing sites and market-data partners.',
    sections: [
      {
        heading: 'Liquidity-lock feed',
        body: 'GET /v1/liquidity-locks returns active liquidity-token locks and locked V3 positions. Each record includes the network, pool address, locked amount, percentage when available, unlock date, permanent status, USD value, and transaction proof.',
      },
      {
        heading: 'Check one pool',
        body: 'GET /v1/pools/:chainId/:poolAddress/locks returns the combined lock status for a specific pool. DEXTools, DexScreener, explorers, and bots can use this route when rendering a single trading pair.',
      },
      {
        heading: 'Freshness',
        body: 'New lock transactions normally appear within a few minutes. Prices and USD values refresh every five minutes. Permanent positions return a null unlock date because they cannot be withdrawn.',
      },
    ],
  },
]

export function Docs() {
  const [active, setActive] = useState(GUIDES[0].title)
  const guide = GUIDES.find(item => item.title === active) || GUIDES[0]

  return (
    <div className="inner-page docs-page">
      <motion.div className="page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="page-title-row">
          <BookOpen size={22} color="var(--accent)" />
          <h1 className="page-title">Genesis Locker guide</h1>
        </div>
        <p className="page-desc">Clear answers for creating, checking, and sharing locks.</p>
      </motion.div>

      <div className="docs-layout">
        <nav className="docs-nav" aria-label="Documentation sections">
          {GUIDES.map(item => (
            <button key={item.title} type="button" onClick={() => setActive(item.title)} className={`nav-item${active === item.title ? ' active' : ''}`}>
              <item.icon size={14} />
              {item.title}
            </button>
          ))}
        </nav>

        <motion.article key={guide.title} className="docs-article" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
          <header className="docs-article-header">
            <guide.icon size={20} color="var(--accent)" />
            <div>
              <h2>{guide.title}</h2>
              <p>{guide.summary}</p>
            </div>
          </header>

          <div className="docs-prose">
            {guide.sections.map(section => (
              <section key={section.heading}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
                {section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}
              </section>
            ))}
          </div>

          {guide.note && <div className="docs-note"><ShieldCheck size={16} /> <span>{guide.note}</span></div>}
        </motion.article>
      </div>
    </div>
  )
}
