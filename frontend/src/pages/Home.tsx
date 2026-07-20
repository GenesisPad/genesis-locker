import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Search, Lock, Infinity,
  Layers, Coins, ChevronRight, Lightbulb, ArrowRight,
  Shield, CheckCircle, Users
} from 'lucide-react'
import { RiskBadge, RISK_BADGES } from '../components/RiskBadge'
import { motion } from 'framer-motion'
import { api, formatUsd, formatAmount, formatDate, proofPath, type ApiLock, type GlobalStats } from '../lib/api'
import { getChainById } from '../lib/chains'
import { parseMetadataURI } from '../lib/metadata'

/* ---------- Real-data helpers ---------- */

type StatDef = { label: string; icon: typeof Layers; value: (s: GlobalStats) => string }

// No historical snapshots exist yet (would need a daily-rollup job), so these
// show the real current value with no 24h trend rather than a fabricated one.
const STAT_DEFS: StatDef[] = [
  { label: 'Total TVL', icon: Layers, value: s => formatUsd(s.totalTvl) },
  { label: 'Locked Positions', icon: TrendingUp, value: s => (s.totalV3PositionLocks ?? 0).toLocaleString() },
  { label: 'Collected Fees', icon: Coins, value: s => s.totalV3AccruedFeesUsd ? formatUsd(s.totalV3AccruedFeesUsd) : 'Unavailable' },
  { label: 'Total Locks', icon: Lock, value: s => (s.totalLocks ?? 0).toLocaleString() },
  { label: 'Permanent', icon: Infinity, value: s => (s.totalPermanentLocks ?? 0).toLocaleString() },
  { label: 'Unique Lockers', icon: Users, value: s => (s.uniqueLockers ?? 0).toLocaleString() },
]

function assetLabel(lock: ApiLock) {
  if (lock.token?.symbol) return lock.token.symbol
  if (lock.token?.name) return lock.token.name
  return `${lock.assetAddress.slice(0, 6)}...${lock.assetAddress.slice(-4)}`
}

function lockStatus(lock: ApiLock): 'permanent' | 'active' | 'withdrawn' {
  if (lock.isPermanent) return 'permanent'
  return BigInt(lock.remainingLockedAmount || '0') > 0n ? 'active' : 'withdrawn'
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function lockLogo(lock: ApiLock) {
  return parseMetadataURI(lock.metadataURI)?.logo || null
}

/** Renders a token's uploaded logo when present, falling back to the letter avatar. */
function AssetAvatar({ lock, className, style }: { lock: ApiLock; className?: string; style?: React.CSSProperties }) {
  const logo = lockLogo(lock)
  if (logo) {
    return <img src={logo} alt="" className={className} style={{ ...style, objectFit: 'cover' }} />
  }
  return (
    <div className={className} style={style}>
      {assetLabel(lock).slice(0, 2)}
    </div>
  )
}

/* ---------- Sub-components ---------- */

function LockSVG() {
  return (
    <svg viewBox="0 0 120 148" width="136" height="168" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shackle-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e5feaa" />
          <stop offset="100%" stopColor="#d5fd51" />
        </linearGradient>
        <linearGradient id="body-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#202a10" />
          <stop offset="60%" stopColor="#303d19" />
          <stop offset="100%" stopColor="#19210c" />
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
      <rect x="10" y="67" width="100" height="72" rx="12" fill="none" stroke="rgba(213, 253, 81,0.3)" strokeWidth="1" />
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
    <img
      src="/chain-robinhood.png"
      alt="Robinhood Chain"
      width={20}
      height={20}
      style={{ borderRadius: 5, objectFit: 'cover' }}
    />
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

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Layers }) {
  const displayed = useCountUp(value)
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon"><Icon size={13} /></span>
      </div>
      <div className="stat-value">{displayed}</div>
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
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [locks, setLocks] = useState<ApiLock[]>([])
  const [launchPositions, setLaunchPositions] = useState<ApiLock[]>([])
  const [locksLoaded, setLocksLoaded] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => {
      api.stats().then(value => active && setStats(value)).catch(() => active && setStats(null))
      api.locks(50).then(r => active && setLocks(r.locks)).catch(() => active && setLocks([])).finally(() => active && setLocksLoaded(true))
      api.positions(8).then(r => active && setLaunchPositions(r.locks)).catch(() => active && setLaunchPositions([]))
    }
    load()
    const interval = window.setInterval(load, 15_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const latestLocks = locks.slice(0, 5)
  const highestValueLocks = [...locks]
    .filter(l => Number(l.tvlUsd) > 0)
    .sort((a, b) => Number(b.tvlUsd) - Number(a.tvlUsd))
    .slice(0, 5)
  const upcomingUnlocks = locks
    .filter(l => !l.isPermanent && l.unlockDate && daysUntil(l.unlockDate)! >= 0)
    .sort((a, b) => new Date(a.unlockDate!).getTime() - new Date(b.unlockDate!).getTime())
    .slice(0, 3)

  function lockAmountLabel(lock: ApiLock) {
    if (lock.assetType === 'v3_position') return '1 locked position'
    return formatAmount(lock.amount, lock.token?.decimals ?? 18)
  }

  function lockValueLabel(lock: ApiLock) {
    return lock.tvlUsd ? formatUsd(lock.tvlUsd) : 'Value unavailable'
  }

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
            Genesis <span className="accent">Locker</span>
          </h1>
          <p className="hero-sub">
            One proof surface for ERC20 tokens, liquidity tokens and Genesis launch positions. On-chain facts first, no fabricated values.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/create')}>
              <Lock size={14} />
              Create a Lock
            </button>
            <button className="btn-secondary" onClick={() => navigate('/locks')}>
              View Locks
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
        {stats
          ? STAT_DEFS.map(s => <StatCard key={s.label} label={s.label} icon={s.icon} value={s.value(stats)} />)
          : STAT_DEFS.map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-top">
                  <span className="stat-label">{s.label}</span>
                  <span className="stat-icon"><s.icon size={13} /></span>
                </div>
                <div className="stat-value">—</div>
              </div>
            ))}
      </motion.div>

      {/* Search */}
      <section className="search-section">
        <div className="search-bar">
          <span className="search-icon"><Search size={15} /></span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(`/search?q=${query}`)}
            placeholder="Search token, wallet, pool, position ID or lock ID"
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

      {/* Launchpad Positions */}
      <section className="launch-positions-panel">
        <div className="section-header">
          <div>
            <span className="section-kicker">Genesis Launchpad</span>
            <div className="section-title">Locked Positions</div>
          </div>
          <a className="view-all" onClick={() => navigate('/positions')}>
            View all positions <ChevronRight size={13} />
          </a>
        </div>

        {locksLoaded && launchPositions.length === 0 && (
          <div className="empty-state" style={{ margin: 0 }}>
            Launch-created positions will appear here after the locker indexer sees the on-chain lock event.
          </div>
        )}

        {launchPositions.length > 0 && (
          <div className="launch-position-grid">
            {launchPositions.slice(0, 4).map(lock => {
              const chainName = getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`
              return (
                <button className="launch-position-card" key={`${lock.chainId}-${lock.contractAddress}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))}>
                  <AssetAvatar lock={lock} className="launch-position-avatar" />
                  <div className="launch-position-main">
                    <div className="launch-position-title">{assetLabel(lock)}</div>
                    <div className="launch-position-meta">{chainName} - Position #{lock.positionTokenId || lock.lockId}</div>
                  </div>
                  <div className="launch-position-value">
                    <span>{lockValueLabel(lock)}</span>
                    <small>Permanent</small>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

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
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locksLoaded && latestLocks.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '28px 0', color: 'var(--dim)' }}>
                    No locks yet. Be the first to lock on Genesis Locker.
                  </td></tr>
                )}
                {latestLocks.map(lock => {
                  const pct = lock.lockedPercentage ? Number(lock.lockedPercentage) : 0
                  const status = lockStatus(lock)
                  const chainName = getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`
                  return (
                    <tr key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))}>
                      <td>
                        <div className="asset-cell">
                          <AssetAvatar lock={lock} className="asset-avatar" style={{ background: '#141a10', color: '#e5feaa' }} />
                          <div>
                            <div className="asset-name">{assetLabel(lock)}</div>
                            <div className="asset-dex">{chainName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={`type-badge ${lock.assetType}`}>
                          {lock.assetType === 'v3_position' ? 'Locked Position' : lock.assetType === 'lp' ? 'Liquidity Token' : 'Token'}
                        </div>
                        <div className="mode-label">{lock.isPermanent ? 'Permanent' : lock.lockType === 'vesting' ? 'Vesting' : 'Cliff'}</div>
                      </td>
                      <td>
                        <div className="amt-main">{lockAmountLabel(lock)}</div>
                      </td>
                      <td>
                        <div className="date-main">{lock.isPermanent ? 'Permanently' : formatDate(lock.unlockDate)}</div>
                        <div className="days-left">
                          {lock.isPermanent ? 'Withdrawal Renounced' : lock.unlockDate && daysUntil(lock.unlockDate)! >= 0 ? `${daysUntil(lock.unlockDate)} days left` : ''}
                        </div>
                      </td>
                      <td>
                        <div className="pct-wrap">
                          <div className="pct-bar">
                            <div className={`pct-fill ${PctFillClass(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="pct-val">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="lock-value-cell">{lockValueLabel(lock)}</div>
                      </td>
                      <td>
                        <ChevronRight size={14} color="var(--dim)" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Highest Value Locks */}
        <div className="trending-panel">
          <div className="section-header">
            <span className="section-title">Highest Value Locks</span>
            <a className="view-all" onClick={() => navigate('/locks')}>View All <ChevronRight size={13} /></a>
          </div>

          {locksLoaded && highestValueLocks.length === 0 && (
            <div style={{ padding: '14px 2px', color: 'var(--dim)', fontSize: 12.5 }}>
              No priced locks yet.
            </div>
          )}
          {highestValueLocks.map(lock => (
            <div className="trending-item" key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))} style={{ cursor: 'pointer' }}>
              <AssetAvatar lock={lock} className="t-avatar" style={{ background: '#141a10', color: '#e5feaa' }} />
              <div className="t-info">
                <div className="t-name">{assetLabel(lock)}</div>
                <div className="t-dex">{getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`}</div>
              </div>
              <div className="t-right">
                <div className="t-tvl">{formatUsd(lock.tvlUsd)}</div>
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
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', background: 'rgba(213, 253, 81,0.08)', border: '1px solid rgba(213, 253, 81,0.25)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
          >
            View Calendar <ChevronRight size={13} />
          </button>
        </div>
        <div className="home-unlocks-grid">
          {locksLoaded && upcomingUnlocks.length === 0 && (
            <div style={{ padding: '14px 2px', color: 'var(--dim)', fontSize: 12.5 }}>
              No upcoming unlocks yet.
            </div>
          )}
          {upcomingUnlocks.map(lock => {
            const days = daysUntil(lock.unlockDate)!
            const chainName = getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`
            return (
              <div
                key={`${lock.chainId}-${lock.lockId}`}
                onClick={() => navigate(proofPath(lock))}
                style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <AssetAvatar
                  lock={lock}
                  style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(213, 253, 81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{assetLabel(lock)}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', gap: 5 }}>
                    <span style={{ fontWeight: 600 }}>{chainName}</span>
                    {' | '}{lock.assetType === 'v3_position' ? 'Position' : lock.assetType === 'lp' ? 'Liquidity' : 'Token'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{lock.tvlUsd ? formatUsd(lock.tvlUsd) : 'Unavailable'}</div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: days <= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(225,183,92,0.1)', color: days <= 7 ? 'var(--danger)' : 'var(--warning)', border: `1px solid ${days <= 7 ? 'rgba(239,68,68,0.25)' : 'rgba(225,183,92,0.25)'}` }}>
                    {days}d
                  </span>
                </div>
              </div>
            )
          })}
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
