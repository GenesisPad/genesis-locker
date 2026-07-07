import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import {
  Vote, Users, Wallet, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronUp, AlertTriangle, Shield, Coins,
  UserPlus, Settings, DollarSign, Lock,
} from 'lucide-react'

// ── types ────────────────────────────────────────────────────────────────────

type ProposalStatus = 'active' | 'passed' | 'rejected' | 'pending'
type ProposalCategory = 'payment' | 'membership' | 'treasury' | 'platform'

interface Proposal {
  id: number
  title: string
  description: string
  category: ProposalCategory
  proposer: string
  status: ProposalStatus
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  quorum: number
  endsIn: string | null
  endedOn: string | null
  amount?: string
}

// ── mock data ────────────────────────────────────────────────────────────────

const PROPOSALS: Proposal[] = [
  {
    id: 7,
    title: 'Compensate @alexdev for Q1 2026 Smart Contract Work',
    description:
      'Alex contributed 3 months of full-time smart contract development including the vesting module, gas optimizations across all locker contracts, and the multi-sig upgrade. This proposal covers his agreed compensation of 8,000 LOCK tokens.',
    category: 'payment',
    proposer: '0x3f4a...c91b',
    status: 'active',
    votesFor: 142,
    votesAgainst: 38,
    votesAbstain: 14,
    quorum: 200,
    endsIn: '2d 14h',
    endedOn: null,
    amount: '8,000 LOCK (~$2,400)',
  },
  {
    id: 6,
    title: 'Allocate $15,000 for CertiK Security Audit',
    description:
      'The DAO proposes allocating $15,000 from the treasury to conduct a full smart contract security audit with CertiK prior to mainnet launch. A clean audit report is required before public release.',
    category: 'treasury',
    proposer: '0x7b2c...d48e',
    status: 'active',
    votesFor: 203,
    votesAgainst: 11,
    votesAbstain: 8,
    quorum: 200,
    endsIn: '1d 2h',
    endedOn: null,
    amount: '$15,000 from Treasury',
  },
  {
    id: 5,
    title: 'Add @sarah_ui to Core Contributors',
    description:
      'Sarah has been contributing UI/UX designs and front-end implementation for 2 months under a provisional role. This proposal nominates her as a Core Contributor, granting her full voting rights and a monthly LOCK token allocation.',
    category: 'membership',
    proposer: '0x9a1d...f72c',
    status: 'active',
    votesFor: 87,
    votesAgainst: 14,
    votesAbstain: 6,
    quorum: 200,
    endsIn: '4d 6h',
    endedOn: null,
  },
  {
    id: 4,
    title: 'Reduce Platform Lock Fee from 0.1% to 0.05%',
    description:
      'Proposal to halve the platform fee on all new locks to remain competitive with Unicrypt and Team Finance. Revenue modelling suggests the volume increase offsets the fee reduction within 60 days.',
    category: 'platform',
    proposer: '0x2e8f...a13d',
    status: 'active',
    votesFor: 61,
    votesAgainst: 55,
    votesAbstain: 22,
    quorum: 200,
    endsIn: '6d 18h',
    endedOn: null,
  },
  {
    id: 3,
    title: 'Launch Community Grants Program (Season 1)',
    description:
      'Establish a recurring community grants program with a $20,000 seasonal budget to fund ecosystem projects, integrations, and tooling built on Genesis Locker.',
    category: 'treasury',
    proposer: '0x1a7b...e90c',
    status: 'passed',
    votesFor: 310,
    votesAgainst: 41,
    votesAbstain: 19,
    quorum: 200,
    endsIn: null,
    endedOn: 'May 3, 2026',
    amount: '$20,000/season',
  },
  {
    id: 2,
    title: 'Increase Platform Fee to 0.2%',
    description:
      'Proposal to double the platform fee to fund faster development. Community voted against due to competitive concerns.',
    category: 'platform',
    proposer: '0x8c4e...b57a',
    status: 'rejected',
    votesFor: 68,
    votesAgainst: 241,
    votesAbstain: 29,
    quorum: 200,
    endsIn: null,
    endedOn: 'Apr 18, 2026',
  },
  {
    id: 1,
    title: 'Establish DAO Treasury Multi-sig (3/5)',
    description:
      'Founding proposal to set up a 3-of-5 multi-sig wallet as the DAO treasury, with signers from the founding team.',
    category: 'platform',
    proposer: '0x5d2a...c80f',
    status: 'passed',
    votesFor: 189,
    votesAgainst: 7,
    votesAbstain: 4,
    quorum: 200,
    endsIn: null,
    endedOn: 'Mar 29, 2026',
  },
]

// ── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<ProposalCategory, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  payment:    { label: 'Payment',    color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  Icon: DollarSign },
  membership: { label: 'Membership', color: '#8fd6ac', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  Icon: UserPlus   },
  treasury:   { label: 'Treasury',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  Icon: Coins      },
  platform:   { label: 'Platform',   color: '#f1cb73', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', Icon: Settings   },
}

const STATUS_META: Record<ProposalStatus, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: 'Active',   color: '#8fd6ac', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)'  },
  passed:   { label: 'Passed',   color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)'  },
  rejected: { label: 'Rejected', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  pending:  { label: 'Pending',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)'  },
}

function VoteBar({ votesFor, votesAgainst, votesAbstain }: Pick<Proposal, 'votesFor' | 'votesAgainst' | 'votesAbstain'>) {
  const total = votesFor + votesAgainst + votesAbstain || 1
  const forPct     = Math.round((votesFor     / total) * 100)
  const againstPct = Math.round((votesAgainst / total) * 100)
  const abstainPct = 100 - forPct - againstPct

  return (
    <div>
      {/* Stacked bar */}
      <div style={{ height: 6, borderRadius: 999, display: 'flex', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 8 }}>
        <div style={{ width: `${forPct}%`,     background: '#34d399', transition: 'width 0.6s ease-out' }} />
        <div style={{ width: `${againstPct}%`, background: '#f87171', transition: 'width 0.6s ease-out' }} />
        <div style={{ width: `${abstainPct}%`, background: 'rgba(255,255,255,0.12)', transition: 'width 0.6s ease-out' }} />
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'For',     pct: forPct,     count: votesFor,     color: '#34d399' },
          { label: 'Against', pct: againstPct, count: votesAgainst, color: '#f87171' },
          { label: 'Abstain', pct: abstainPct, count: votesAbstain, color: 'var(--dim)' },
        ].map(v => (
          <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>{v.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: v.color }}>{v.pct}%</span>
            <span style={{ fontSize: 10, color: 'var(--dim)' }}>({v.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuorumMeter({ total, quorum }: { total: number; quorum: number }) {
  const pct = Math.min((total / quorum) * 100, 100)
  const met = total >= quorum
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: met ? '#34d399' : '#fbbf24', transition: 'width 0.6s ease-out' }} />
      </div>
      <span style={{ fontSize: 10, color: met ? '#34d399' : '#fbbf24', whiteSpace: 'nowrap', fontWeight: 600 }}>
        {total}/{quorum} {met ? '✓ Quorum met' : 'needed'}
      </span>
    </div>
  )
}

// ── proposal card ─────────────────────────────────────────────────────────────

function ProposalCard({ p, canVote }: { p: Proposal; canVote: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [voted,    setVoted]    = useState<'for' | 'against' | 'abstain' | null>(null)
  const cat = CATEGORY_META[p.category]
  const st  = STATUS_META[p.status]
  const total = p.votesFor + p.votesAgainst + p.votesAbstain

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--card)', border: `1px solid var(--border)`,
        borderRadius: 12, overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}
        onClick={() => setExpanded(x => !x)}
      >
        {/* Category icon */}
        <div style={{ width: 36, height: 36, borderRadius: 9, background: cat.bg, border: `1px solid ${cat.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <cat.Icon size={15} color={cat.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
              {cat.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              {st.label}
            </span>
            <span style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 'auto' }}>#{p.id} · by {p.proposer}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10, lineHeight: 1.4 }}>{p.title}</div>
          <VoteBar votesFor={p.votesFor} votesAgainst={p.votesAgainst} votesAbstain={p.votesAbstain} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, paddingTop: 2 }}>
          {p.status === 'active' && p.endsIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
              <Clock size={10} /> {p.endsIn} left
            </div>
          )}
          {p.status !== 'active' && p.endedOn && (
            <div style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{p.endedOn}</div>
          )}
          {expanded ? <ChevronUp size={14} color="var(--dim)" /> : <ChevronDown size={14} color="var(--dim)" />}
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Description */}
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>{p.description}</p>

              {/* Amount if any */}
              {p.amount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <DollarSign size={12} color="#fbbf24" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>Amount: {p.amount}</span>
                </div>
              )}

              {/* Quorum */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 5 }}>Quorum progress</div>
                <QuorumMeter total={total} quorum={p.quorum} />
              </div>

              {/* Vote buttons */}
              {p.status === 'active' && (
                <div>
                  {voted ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#34d399' }}>
                      <CheckCircle size={14} /> Vote cast: <strong style={{ textTransform: 'capitalize' }}>{voted}</strong>
                    </div>
                  ) : canVote ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { key: 'for',     label: '👍 Vote For',     color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
                        { key: 'against', label: '👎 Vote Against', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
                        { key: 'abstain', label: 'Abstain',         color: 'var(--dim)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)'       },
                      ] as const).map(btn => (
                        <button
                          key={btn.key}
                          onClick={() => setVoted(btn.key)}
                          style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: btn.color, background: btn.bg, border: `1px solid ${btn.border}`, transition: 'opacity 0.15s' }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#fbbf24' }}>
                      <Lock size={12} /> Hold LOCK tokens to vote on proposals.
                    </div>
                  )}
                </div>
              )}

              {/* Outcome for closed proposals */}
              {p.status !== 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: p.status === 'passed' ? '#34d399' : '#f87171' }}>
                  {p.status === 'passed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {p.status === 'passed' ? 'Proposal passed' : 'Proposal rejected'} — {p.endedOn}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

const ACTIVE_PROPOSALS  = PROPOSALS.filter(p => p.status === 'active')
const CLOSED_PROPOSALS  = PROPOSALS.filter(p => p.status !== 'active')
const TREASURY_USD      = '$48,320'
const TREASURY_LOCK     = '240,000 LOCK'

export function DAO() {
  const { isConnected } = useAccount()
  const [tab, setTab] = useState<'active' | 'closed'>('active')

  // Mock: treat connected wallet as a token holder for demo
  const isTokenHolder = isConnected
  const canVote = isTokenHolder

  const statsItems = [
    { icon: Vote,    label: 'Active Proposals',  value: String(ACTIVE_PROPOSALS.length) },
    { icon: CheckCircle, label: 'Proposals Passed', value: String(PROPOSALS.filter(p => p.status === 'passed').length) },
    { icon: Coins,   label: 'Treasury Balance',  value: TREASURY_USD },
    { icon: Users,   label: 'Eligible Voters',   value: '1,240' },
  ]

  return (
    <div className="explorer-page">

      {/* Heading */}
      <motion.div className="page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="page-title">DAO Governance</h1>
        <p className="page-desc">
          Community-owned decisions, enforced on-chain. LOCK token holders vote on payments, memberships, treasury spending, and platform changes. Everyone can see what's happening.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}
      >
        {statsItems.map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(217, 173, 74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={15} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Treasury snapshot */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
        style={{ background: 'linear-gradient(135deg, rgba(217, 173, 74,0.1) 0%, rgba(103, 199, 144,0.06) 100%)', border: '1px solid rgba(217, 173, 74,0.2)', borderRadius: 12, padding: '16px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 2 }}>DAO Treasury</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{TREASURY_USD} <span style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 500 }}>/ {TREASURY_LOCK}</span></div>
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', flex: 1, minWidth: 200 }}>
          Controlled by a 3-of-5 community multi-sig. No single party can move funds unilaterally. All transfers require a passed DAO proposal.
        </div>

        {/* Wallet / eligibility status */}
        {!isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#fbbf24', whiteSpace: 'nowrap' }}>
            <Wallet size={13} /> Connect wallet to vote
          </div>
        ) : isTokenHolder ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', fontSize: 12, color: '#34d399', whiteSpace: 'nowrap' }}>
            <CheckCircle size={13} /> Eligible to vote
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 12, color: '#f87171', whiteSpace: 'nowrap' }}>
            <Lock size={13} /> No LOCK tokens detected
          </div>
        )}
      </motion.div>

      {/* How voting works */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 26 }}
      >
        {[
          { icon: Coins,    title: 'Hold LOCK tokens',       desc: 'Any wallet holding LOCK tokens is eligible. Voting power is proportional to your balance.' },
          { icon: Vote,     title: 'Vote on proposals',      desc: 'Cast For, Against, or Abstain on any active proposal. One vote per wallet per proposal.' },
          { icon: Users,    title: 'Reach quorum',           desc: 'A proposal needs 200 total votes to reach quorum. Below quorum, the result is non-binding.' },
          { icon: CheckCircle, title: 'Outcome enforced',   desc: 'Passed proposals are executed by the multi-sig within 48 hours. Results are permanent on-chain.' },
        ].map((step, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(217, 173, 74,0.1)', border: '1px solid rgba(217, 173, 74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <step.icon size={13} color="var(--accent)" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Proposal type legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(CATEGORY_META).map(([key, { label, color, bg, border, Icon }]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: bg, border: `1px solid ${border}` }}>
            <Icon size={11} color={color} />
            <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'center', marginLeft: 4 }}>proposal types</span>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([
          { key: 'active', label: `Active (${ACTIVE_PROPOSALS.length})` },
          { key: 'closed', label: `Closed (${CLOSED_PROPOSALS.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--text)' : 'var(--dim)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}

        {!canVote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', fontSize: 11, color: 'var(--dim)' }}>
            <AlertTriangle size={11} color="var(--warning)" />
            {isConnected ? 'No LOCK tokens — view only' : 'Connect wallet to vote'}
          </div>
        )}
      </div>

      {/* Proposals */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {(tab === 'active' ? ACTIVE_PROPOSALS : CLOSED_PROPOSALS).map(p => (
            <ProposalCard key={p.id} p={p} canVote={canVote} />
          ))}
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
