import React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  FileCheck2,
  GitPullRequest,
  HandHeart,
  ShieldCheck,
  Users,
  Vote,
  Wallet
} from 'lucide-react'

const fundingSplit = [
  { label: 'Founder recipient', value: '20%', note: 'Operator revenue for maintaining the platform and supporting launch work.' },
  { label: 'Community multisig', value: '80%', note: 'Contributor grants, audits, docs, integrations, infrastructure, and community growth.' },
]

const grantCategories = [
  'Smart contract testing, audits, and security hardening',
  'API, indexer, database, and analytics improvements',
  'Frontend features, accessibility, and wallet UX',
  'Documentation, examples, tutorials, and translations',
  'DEX, explorer, wallet, and community dashboard integrations',
  'Community support, education, launch operations, and moderation tools',
]

const proposalSteps = [
  {
    title: 'Contributor proposes work',
    body: 'A contributor describes the deliverable, target date, requested grant amount, payout address, and review criteria.',
    icon: GitPullRequest,
  },
  {
    title: 'Community reviews the proposal',
    body: 'Leaders and contributors discuss whether the work improves Genesis Locker, fills a real need, and fits available treasury funds.',
    icon: Users,
  },
  {
    title: 'Leaders vote on funding',
    body: 'The five initial multisig leaders vote. Approved grants move to milestone tracking or payment authorization.',
    icon: Vote,
  },
  {
    title: 'Work is delivered and verified',
    body: 'Maintainers review the pull request, docs, integration, or community deliverable before payment is released.',
    icon: FileCheck2,
  },
  {
    title: 'Treasury reports the payment',
    body: 'Every payment is recorded in the monthly treasury report with purpose, recipient, amount, and remaining balance.',
    icon: BadgeCheck,
  },
]

const leaderResponsibilities = [
  'Protect the community treasury from rushed or private spending decisions',
  'Vote on grants using public proposals and clear platform priorities',
  'Review whether delivered work matches the approved scope',
  'Add more trusted signers as the contributor base grows',
  'Publish spending decisions, signer changes, and monthly treasury reports',
]

const benefits = [
  {
    title: 'For contributors',
    body: 'Useful work can be rewarded without needing a private job offer. Contributors can build reputation through shipped code, docs, integrations, support, and security work.',
  },
  {
    title: 'For the community',
    body: 'The protocol becomes less founder-dependent because the people using and improving it can direct most fee revenue toward public priorities.',
  },
  {
    title: 'For projects using Genesis Locker',
    body: 'A healthier contributor ecosystem means better uptime, better documentation, faster integrations, clearer risk labels, and more trustworthy lock data.',
  },
]

export function CommunityGrants() {
  return (
    <div className="community-page">
      <motion.div
        className="page-heading community-heading"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="community-kicker">
          <HandHeart size={16} />
          Community funded development
        </div>
        <h1 className="page-title community-title">Community Grants</h1>
        <p className="page-desc community-desc">
          Genesis Locker uses protocol fees to reward useful public work. The founder receives a smaller operator share, while the community multisig receives the larger share so trusted leaders can fund contributors, audits, infrastructure, integrations, and education.
        </p>
      </motion.div>

      <section className="community-ledger">
        {fundingSplit.map(item => (
          <div className="community-ledger-row" key={item.label}>
            <div>
              <div className="community-ledger-label">{item.label}</div>
              <p>{item.note}</p>
            </div>
            <span>{item.value}</span>
          </div>
        ))}
      </section>

      <section className="community-grid">
        <motion.div
          className="community-panel community-panel-large"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <div className="community-panel-head">
            <Wallet size={18} color="var(--success)" />
            <h2>How the multisig works</h2>
          </div>
          <p className="community-copy">
            The community treasury should be held by a public multisig wallet. At launch, at least five community leaders should be signers. Those leaders should be selected for trust, technical judgment, communication, and willingness to be accountable in public.
          </p>
          <div className="community-rule-list">
            <div>
              <span>1</span>
              <p>Five initial leaders become multisig signers before mainnet fee collection begins.</p>
            </div>
            <div>
              <span>2</span>
              <p>Spending decisions require a signer vote, not a private founder instruction.</p>
            </div>
            <div>
              <span>3</span>
              <p>More signers can be added later when the community has proven contributors and regional leaders.</p>
            </div>
            <div>
              <span>4</span>
              <p>Signer additions, removals, and threshold changes should be announced and documented.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="community-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <div className="community-panel-head">
            <ShieldCheck size={18} color="var(--blue)" />
            <h2>Governance guardrails</h2>
          </div>
          <p className="community-copy">
            The multisig should fund progress, not personalities. Every payment needs a public reason, a clear deliverable, and a way for the community to verify what was completed.
          </p>
          <ul className="community-checks">
            <li>Public proposal before payment</li>
            <li>Clear milestone or completed deliverable</li>
            <li>Vote recorded by community leaders</li>
            <li>Monthly treasury report after payment</li>
          </ul>
        </motion.div>
      </section>

      <section className="community-section">
        <div className="community-section-head">
          <CircleDollarSign size={18} color="var(--warning)" />
          <h2>What grants can fund</h2>
        </div>
        <div className="community-category-grid">
          {grantCategories.map(category => (
            <div className="community-category" key={category}>
              <ArrowRight size={13} />
              <span>{category}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="community-section">
        <div className="community-section-head">
          <Vote size={18} color="var(--purple)" />
          <h2>Proposal and payment flow</h2>
        </div>
        <div className="community-timeline">
          {proposalSteps.map((step, index) => (
            <motion.div
              className="community-step"
              key={step.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 * index }}
            >
              <div className="community-step-icon">
                <step.icon size={15} />
              </div>
              <div>
                <div className="community-step-title">{step.title}</div>
                <p>{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="community-grid">
        <div className="community-panel">
          <div className="community-panel-head">
            <Users size={18} color="var(--success)" />
            <h2>Leader responsibilities</h2>
          </div>
          <ul className="community-checks">
            {leaderResponsibilities.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="community-panel community-panel-large">
          <div className="community-panel-head">
            <HandHeart size={18} color="var(--purple)" />
            <h2>Who benefits</h2>
          </div>
          <div className="community-benefits">
            {benefits.map(item => (
              <div key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
