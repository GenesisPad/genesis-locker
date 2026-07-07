import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Search, Lock, Infinity,
  Layers, Coins, ChevronRight, Lightbulb, ArrowRight,
  Shield, CheckCircle, Users
} from 'lucide-react'
import { RiskBadge, RISK_BADGES } from '../components/RiskBadge'
import { motion } from 'framer-motion'

/* ---------- Data ---------- */

const stats = [
  {
    label: 'Total TVL',
    value: '$128.7M',
    trend: '+12.45%',
    up: true,
    icon: Layers,
  },
  {
    label: 'LP Locks',
    value: '$93.6M',
    trend: '+10.21%',
    up: true,
    icon: TrendingUp,
  },
  {
    label: 'Token Locks',
    value: '$35.1M',
    trend: '+15.27%',
    up: true,
    icon: Coins,
  },
  {
    label: 'Total Locks',
    value: '18,742',
    trend: '+8.32%',
    up: true,
    icon: Lock,
  },
  {
    label: 'Permanent',
    value: '4,291',
    trend: '+3.14%',
    up: true,
    icon: Infinity,
  },
  {
    label: 'Unique Lockers',
    value: '3,241',
    trend: '+5.82%',
    up: true,
    icon: Users,
  },
]

type LockMode = 'Cliff' | 'Vesting' | 'Permanent'
type LockType = 'lp' | 'token'
type LockStatus = 'active' | 'permanent' | 'expired'

interface LockRow {
  id: number
  name: string
  dex: string
  type: LockType
  mode: LockMode
  amount: string
  amountUsd: string
  until: string
  daysLeft: string
  pct: number
  status: LockStatus
  chain: 'eth' | 'bnb' | 'base'
  colors: { bg: string; text: string }
}

const LOCKS: LockRow[] = [
  {
    id: 1, name: 'UNI / WETH', dex: 'Uniswap V3', type: 'lp', mode: 'Cliff',
    amount: '1,250.45 LP', amountUsd: '$2,842,450', until: 'Dec 31, 2026', daysLeft: '344 days left',
    pct: 78, status: 'active', chain: 'eth', colors: { bg: '#242018', text: '#f1cb73' },
  },
  {
    id: 2, name: 'PEPE', dex: 'Pepe', type: 'token', mode: 'Vesting',
    amount: '500,000,000', amountUsd: '$1,125,300', until: 'Jun 26, 2027', daysLeft: 'Vesting 12 months',
    pct: 65, status: 'active', chain: 'eth', colors: { bg: '#0d2300', text: '#4ade80' },
  },
  {
    id: 3, name: 'CAKE / BNB', dex: 'PancakeSwap V2', type: 'lp', mode: 'Cliff',
    amount: '2,500.00 LP', amountUsd: '$1,875,600', until: 'Jan 01, 2027', daysLeft: '375 days left',
    pct: 82, status: 'active', chain: 'bnb', colors: { bg: '#1a1000', text: '#fbbf24' },
  },
  {
    id: 4, name: 'DOGE', dex: 'Dogecoin', type: 'token', mode: 'Permanent',
    amount: '100,000,000', amountUsd: '$943,200', until: 'Permanently', daysLeft: 'Withdrawal Renounced',
    pct: 100, status: 'permanent', chain: 'eth', colors: { bg: '#1a1000', text: '#f59e0b' },
  },
  {
    id: 5, name: 'USDC / ETH', dex: 'Aerodrome CL', type: 'lp', mode: 'Vesting',
    amount: '750.00 LP', amountUsd: '$1,245,700', until: 'Mar 10, 2027', daysLeft: 'Vesting 6 months',
    pct: 61, status: 'active', chain: 'base', colors: { bg: '#001840', text: '#8fd6ac' },
  },
]

const TRENDING = [
  { name: 'SHIB / WETH', dex: 'Uniswap V3', tvl: '$4.52M', pct: 89, colors: { bg: '#1a0000', text: '#f87171' } },
  { name: 'BUSD / BNB', dex: 'PancakeSwap V2', tvl: '$3.21M', pct: 77, colors: { bg: '#1a1000', text: '#fbbf24' } },
  { name: 'DEGEN', dex: 'Base', tvl: '$2.88M', pct: 64, colors: { bg: '#001230', text: '#8fd6ac' } },
  { name: 'FLOKI', dex: 'Ethereum', tvl: '$2.15M', pct: 61, colors: { bg: '#1a0d00', text: '#fb923c' } },
  { name: 'USDT / USDC', dex: 'Uniswap V3', tvl: '$1.94M', pct: 58, colors: { bg: '#001a0d', text: '#4ade80' } },
]

/* ---------- Sub-components ---------- */

function LockSVG() {
  return (
    <svg viewBox="0 0 120 148" width="136" height="168" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shackle-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1cb73" />
          <stop offset="100%" stopColor="#d9ad4a" />
        </linearGradient>
        <linearGradient id="body-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a2410" />
          <stop offset="60%" stopColor="#3d3319" />
          <stop offset="100%" stopColor="#211c0c" />
        </linearGradient>
        <linearGradient id="shine-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <filter id="lock-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Shackle */}
      <path
        d="M28 72V44C28 20 92 20 92 44V72"
        fill="none"
        stroke="url(#shackle-g)"
        strokeWidth="9"
        strokeLinecap="round"
        filter="url(#lock-glow)"
      />
      {/* Body */}
      <rect x="10" y="67" width="100" height="72" rx="12" fill="url(#body-g)" />
      {/* Shine */}
      <rect x="10" y="67" width="100" height="26" rx="12" fill="url(#shine-g)" />
      {/* Keyhole circle */}
      <circle cx="60" cy="100" r="10" fill="rgba(0,0,0,0.45)" />
      {/* Keyhole slot */}
      <rect x="56.5" y="108" width="7" height="17" rx="3.5" fill="rgba(0,0,0,0.45)" />
      {/* Body border glow */}
      <rect x="10" y="67" width="100" height="72" rx="12" fill="none" stroke="rgba(217, 173, 74,0.3)" strokeWidth="1" />
    </svg>
  )
}

function EthIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L7 16.5L16 20.5L25 16.5L16 4Z" fill="#627EEA" opacity="0.8" />
      <path d="M16 4L7 16.5L16 20.5V4Z" fill="#627EEA" />
      <path d="M16 22.5L7 18L16 28L25 18L16 22.5Z" fill="#627EEA" opacity="0.8" />
      <path d="M16 22.5L7 18L16 28V22.5Z" fill="#627EEA" />
    </svg>
  )
}

function BNBIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L19.5 7.5L13 14L9.5 10.5L16 4Z" fill="#F3BA2F" />
      <path d="M20 8L23.5 11.5L17 18L13.5 14.5L20 8Z" fill="#F3BA2F" />
      <path d="M9 13L12.5 16.5L9 20L5.5 16.5L9 13Z" fill="#F3BA2F" />
      <path d="M16 22L19.5 25.5L16 29L12.5 25.5L16 22Z" fill="#F3BA2F" />
      <path d="M23 13L26.5 16.5L23 20L19.5 16.5L23 13Z" fill="#F3BA2F" />
      <path d="M12 16.5L16 12.5L20 16.5L16 20.5L12 16.5Z" fill="#F3BA2F" />
    </svg>
  )
}

function BaseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#0052FF" />
      <path d="M16 6C10.477 6 6 10.477 6 16C6 21.523 10.477 26 16 26C21.523 26 26 21.523 26 16C26 10.477 21.523 6 16 6ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="white" />
    </svg>
  )
}

function RobinhoodIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3C9 8 6 12 6 17.5C6 21 8.2 23 11 23C13.2 23 15 21.4 15 19C15 16.6 13.2 15.5 11.5 15.5C13 12.5 15 9.5 16 8C17 9.5 19 12.5 20.5 15.5C18.8 15.5 17 16.6 17 19C17 21.4 18.8 23 21 23C23.8 23 26 21 26 17.5C26 12 23 8 16 3Z" fill="#d9ad4a" />
    </svg>
  )
}

/* ---------- Count-up hook ---------- */
function useCountUp(target: string, duration = 1200) {
  const [display, setDisplay] = useState('0')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const num = parseFloat(target.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) { setDisplay(target); return }
    const prefix = target.match(/^\$/) ? '$' : ''
    const suffix = target.replace(/^\$?[\d,.]+/, '')
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const cur = num * ease
      const formatted = cur >= 1_000_000
        ? `${(cur / 1_000_000).toFixed(1)}M`
        : cur >= 1000
        ? cur.toLocaleString('en', { maximumFractionDigits: 0 })
        : cur.toFixed(cur < 100 ? 2 : 0)
      setDisplay(`${prefix}${formatted}${suffix}`)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return display
}

function StatCard({ label, value, trend, up, icon: Icon }: typeof stats[0]) {
  const displayed = useCountUp(value)
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon"><Icon size={13} /></span>
      </div>
      <div className="stat-value">{displayed}</div>
      <div className={`stat-trend ${up ? 'up' : 'down'}`}>
        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {trend} (24h)
      </div>
    </div>
  )
}

function PctFillClass(pct: number) {
  if (pct >= 75) return 'high'
  if (pct >= 50) return 'medium'
  return 'low'
}

/* ---------- Page ---------- */

export function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero-eyebrow">
            Robinhood Chain <span className="eyebrow-sep" />
            Ethereum <span className="eyebrow-sep" />
            Base <span className="eyebrow-sep" />
            BNB Chain
          </div>
          <h1 className="hero-title">
            Lock with <span className="accent">Confidence.</span>
            <br />
            Build with <span className="accent">Trust.</span>
          </h1>
          <p className="hero-sub">
            Genesis Locker is a decentralized liquidity and token locker
            built primarily for Robinhood Chain, with support for Ethereum,
            Base and BNB Chain — 100% on-chain transparency.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/create')}>
              <Lock size={14} />
              Create LP Lock
            </button>
            <button className="btn-secondary" onClick={() => navigate('/create')}>
              Create Token Lock
            </button>
          </div>
        </motion.div>

        {/* Lock Illustration */}
        <motion.div
          className="lock-visual"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lock-ambient" />
          <div className="lock-platform" />
          <div className="lock-center">
            <LockSVG />
          </div>
          <div className="chain-float chain-robinhood">
            <RobinhoodIcon />
          </div>
          <div className="chain-float chain-eth">
            <EthIcon />
          </div>
          <div className="chain-float chain-bnb">
            <BNBIcon />
          </div>
          <div className="chain-float chain-base">
            <BaseIcon />
          </div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <motion.div
        className="stats-bar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </motion.div>

      {/* Search */}
      <section className="search-section">
        <div className="search-bar">
          <span className="search-icon"><Search size={15} /></span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(`/search?q=${query}`)}
            placeholder="Search token, LP pair, wallet address or lock ID"
          />
          <button className="search-submit" onClick={() => navigate(`/search?q=${query}`)}>
            Search
          </button>
        </div>
        <div className="search-meta">
          <span className="search-meta-label">Risk flags:</span>
          {RISK_BADGES.map(b => (
            <RiskBadge key={b.label} level={b.level} label={b.label} />
          ))}
        </div>
      </section>

      {/* Networks */}
      <div className="networks-row">
        <span className="networks-label">Supported Networks</span>
        <div className="net-pill">
          <span className="net-dot robinhood" />
          Robinhood Chain
        </div>
        <div className="net-pill">
          <span className="net-dot eth" />
          Ethereum
        </div>
        <div className="net-pill">
          <span className="net-dot base" />
          Base
        </div>
        <div className="net-pill">
          <span className="net-dot bnb" />
          BNB Chain
        </div>
        <span className="min-lock-note">Minimum Lock Duration: 7 days</span>
      </div>

      {/* Locks Grid */}
      <div className="locks-grid">
        {/* Latest Locks */}
        <div className="locks-main">
          <div className="section-header">
            <span className="section-title">Latest Locks</span>
            <a className="view-all" onClick={() => navigate('/locks')}>
              View All Locks <ChevronRight size={13} />
            </a>
          </div>

          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Locked Until</th>
                  <th>Lock %</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {LOCKS.map(lock => (
                  <tr key={lock.id} onClick={() => navigate(`/lock/${lock.id}`)}>
                    <td>
                      <div className="asset-cell">
                        <div
                          className="asset-avatar"
                          style={{ background: lock.colors.bg, color: lock.colors.text }}
                        >
                          {lock.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="asset-name">{lock.name}</div>
                          <div className="asset-dex">{lock.dex}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`type-badge ${lock.type}`}>
                        {lock.type === 'lp' ? 'LP Lock' : 'Token Lock'}
                      </div>
                      <div className="mode-label">{lock.mode}</div>
                    </td>
                    <td>
                      <div className="amt-main">{lock.amount}</div>
                      <div className="amt-usd">{lock.amountUsd}</div>
                    </td>
                    <td>
                      <div className="date-main">{lock.until}</div>
                      <div className="days-left">{lock.daysLeft}</div>
                    </td>
                    <td>
                      <div className="pct-wrap">
                        <div className="pct-bar">
                          <div
                            className={`pct-fill ${PctFillClass(lock.pct)}`}
                            style={{ width: `${lock.pct}%` }}
                          />
                        </div>
                        <span className="pct-val">{lock.pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-chip ${lock.status}`}>
                        {lock.status === 'permanent' ? (
                          <><Infinity size={9} /> Permanent</>
                        ) : lock.status === 'active' ? (
                          <><CheckCircle size={9} /> Active</>
                        ) : 'Expired'}
                      </span>
                    </td>
                    <td>
                      <ChevronRight size={14} color="var(--dim)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trending Panel */}
        <div className="trending-panel">
          <div className="section-header">
            <span className="section-title">Trending Locks</span>
            <a className="view-all">View All <ChevronRight size={13} /></a>
          </div>

          {TRENDING.map(item => (
            <div className="trending-item" key={item.name}>
              <div
                className="t-avatar"
                style={{ background: item.colors.bg, color: item.colors.text }}
              >
                {item.name.slice(0, 2)}
              </div>
              <div className="t-info">
                <div className="t-name">{item.name}</div>
                <div className="t-dex">{item.dex}</div>
              </div>
              <div className="t-right">
                <div className="t-tvl">{item.tvl}</div>
                <div className="t-pct-bar">
                  <div className="t-pct-fill" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            </div>
          ))}

          <div className="dyk-card">
            <div className="dyk-head">
              <Lightbulb size={11} />
              Did you know?
            </div>
            <p className="dyk-text">
              Permanently locking LP tokens shows strong commitment to your community.
            </p>
            <p className="dyk-cta">Build trust. Lock it.</p>
          </div>
        </div>
      </div>

      {/* Upcoming Unlocks Teaser */}
      <div style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Upcoming Unlocks</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>High-value locks expiring soon across all chains</div>
          </div>
          <button
            onClick={() => navigate('/calendar')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', background: 'rgba(217, 173, 74,0.08)', border: '1px solid rgba(217, 173, 74,0.25)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
          >
            View Calendar <ChevronRight size={13} />
          </button>
        </div>
        <div className="home-unlocks-grid">
          {[
            { asset: 'UNI / WETH', chain: 'ETH', tvl: '$2.84M', days: 5, type: 'LP' },
            { asset: 'SHIB / WETH', chain: 'ETH', tvl: '$1.12M', days: 11, type: 'LP' },
            { asset: 'CAKE / BNB', chain: 'BNB', tvl: '$880K', days: 21, type: 'LP' },
          ].map(u => (
            <div
              key={u.asset}
              onClick={() => navigate('/calendar')}
              style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(217, 173, 74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {u.asset.slice(0, 3)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.asset}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', gap: 5 }}>
                  <span style={{ color: u.chain === 'ETH' ? '#627EEA' : '#F3BA2F', fontWeight: 600 }}>{u.chain}</span>
                  · {u.type}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{u.tvl}</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: u.days <= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: u.days <= 7 ? 'var(--danger)' : 'var(--warning)', border: `1px solid ${u.days <= 7 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                  {u.days}d
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div className="cta-banner">
        <div className="cta-left">
          <div className="cta-icon">
            <Shield size={22} />
          </div>
          <div>
            <div className="cta-title">Your locks. On-chain.</div>
            <div className="cta-sub">Transparent forever.</div>
            <div className="cta-desc">
              Genesis Locker is 100% decentralized. We cannot move your funds.
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={() => navigate('/create')}>
          Create Your Lock Now <ArrowRight size={14} />
        </button>
      </div>

      {/* Footer */}
      <footer className="page-footer">
        <span>© {new Date().getFullYear()} Genesis Locker. All rights reserved.</span>
        <div className="footer-links">
          <a href="/docs">Docs</a>
          <a href="/api">API</a>
          <a href="https://github.com/GenesisPad/genesis-locker" target="_blank" rel="noreferrer">Github</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
        </div>
      </footer>
    </div>
  )
}
