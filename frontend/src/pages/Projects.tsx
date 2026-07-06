import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, Shield, TrendingUp, Users, Lock,
  Trophy, Layers, Infinity, CheckCircle,
} from 'lucide-react'
import { MOCK_PROFILES } from '../lib/projectProfiles'
import { ApiLock, api, formatAmount, formatDate, formatUsd } from '../lib/api'

// ─── shared helpers ────────────────────────────────────────────────────────

type ChainF   = 'All' | 'ETH' | 'BNB' | 'Base'
type StatusF  = 'all' | 'renounced' | 'permanent' | 'audited'
type LockFilter = 'all' | 'lp' | 'token' | 'cliff' | 'vesting' | 'permanent'

function scoreColor(s: number) {
  return s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)'
}
function scoreBg(s: number) {
  return s >= 80 ? 'rgba(34,197,94,0.1)' : s >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
}
function formatTvl(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function pctClass(p: number) { return p >= 75 ? 'high' : p >= 50 ? 'medium' : 'low' }
function lockName(lock: ApiLock) {
  return lock.token?.symbol || `${lock.assetAddress.slice(0, 6)}…${lock.assetAddress.slice(-4)}`
}

// ─── tab definitions ────────────────────────────────────────────────────────

const TABS = [
  {
    key: 'projects',
    label: 'Verified Projects',
    icon: Trophy,
    desc: 'Curated registry of projects that have set up a profile and earned a Trust Score — ranked by on-chain credibility.',
  },
  {
    key: 'locks',
    label: 'All Locks',
    icon: Layers,
    desc: 'Raw ledger of every lock created on Genesis Locker, across all chains and asset types — no curation, no minimum score.',
  },
] as const
type TabKey = typeof TABS[number]['key']

// ─── component ─────────────────────────────────────────────────────────────

export function Projects() {
  const navigate      = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeTab     = (params.get('tab') === 'locks' ? 'locks' : 'projects') as TabKey

  function setTab(key: TabKey) {
    if (key === 'projects') {
      setParams({})
    } else {
      setParams({ tab: key })
    }
  }

  // ── Projects tab state ──
  const [query,        setQuery]        = useState('')
  const [chainFilter,  setChainFilter]  = useState<ChainF>('All')
  const [minScore,     setMinScore]     = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusF>('all')

  const visible = useMemo(() => {
    return [...MOCK_PROFILES]
      .filter(p => {
        if (chainFilter !== 'All' && p.chain !== chainFilter) return false
        if (p.trustScore < minScore) return false
        if (statusFilter === 'renounced' && !p.isRenounced) return false
        if (statusFilter === 'permanent' && !p.isPermanent) return false
        if (statusFilter === 'audited'   && !p.isAudited)   return false
        if (query) {
          const q = query.toLowerCase()
          return p.name.toLowerCase().includes(q) ||
                 p.symbol.toLowerCase().includes(q) ||
                 p.address.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => b.trustScore - a.trustScore)
  }, [query, chainFilter, minScore, statusFilter])

  const totalTvl      = MOCK_PROFILES.reduce((s, p) => s + p.tvlLocked, 0)
  const avgScore      = Math.round(MOCK_PROFILES.reduce((s, p) => s + p.trustScore, 0) / MOCK_PROFILES.length)
  const permanentCount = MOCK_PROFILES.filter(p => p.isPermanent).length

  const statItems = [
    { icon: Users,     label: 'Projects Listed',   value: String(MOCK_PROFILES.length) },
    { icon: TrendingUp,label: 'Total TVL Locked',  value: formatTvl(totalTvl) },
    { icon: Shield,    label: 'Avg Trust Score',   value: `${avgScore}/100` },
    { icon: Lock,      label: 'Permanently Locked',value: String(permanentCount) },
  ]

  // ── Locks tab state ──
  const [lockFilter, setLockFilter] = useState<LockFilter>('all')
  const [lockQuery,  setLockQuery]  = useState('')
  const [locks,      setLocks]      = useState<ApiLock[]>([])
  const [loading,    setLoading]    = useState(false)
  const [lockError,  setLockError]  = useState('')

  useEffect(() => {
    if (activeTab !== 'locks' || locks.length > 0) return
    setLoading(true)
    api.locks(100)
      .then(r  => setLocks(r.locks))
      .catch(e => setLockError(e instanceof Error ? e.message : 'Failed to load locks'))
      .finally(() => setLoading(false))
  }, [activeTab])

  const LOCK_FILTERS: { key: LockFilter; label: string }[] = [
    { key: 'all',       label: 'All Locks' },
    { key: 'lp',        label: 'LP Locks' },
    { key: 'token',     label: 'Token Locks' },
    { key: 'cliff',     label: 'Cliff' },
    { key: 'vesting',   label: 'Vesting' },
    { key: 'permanent', label: 'Permanent' },
  ]

  const visibleLocks = useMemo(() => locks.filter(lock => {
    if (lockFilter === 'lp')        return lock.assetType === 'lp'
    if (lockFilter === 'token')     return lock.assetType === 'token'
    if (lockFilter === 'cliff')     return lock.lockType  === 'cliff'
    if (lockFilter === 'vesting')   return lock.lockType  === 'vesting'
    if (lockFilter === 'permanent') return lock.isPermanent
    return true
  }).filter(lock => {
    const hay = `${lockName(lock)} ${lock.assetAddress} ${lock.owner} ${lock.beneficiary}`.toLowerCase()
    return !lockQuery || hay.includes(lockQuery.toLowerCase())
  }), [lockFilter, locks, lockQuery])

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="explorer-page">

      {/* Page heading */}
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">Projects &amp; Locks</h1>
        <p className="page-desc">
          Browse verified projects ranked by trust, or search the raw ledger of every on-chain lock.
        </p>
      </motion.div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px',
              fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === key ? 'var(--text)' : 'var(--dim)',
              borderBottom: `2px solid ${activeTab === key ? 'var(--purple)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <Icon size={13} color={activeTab === key ? 'var(--purple)' : 'var(--dim)'} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab descriptor */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            fontSize: 12.5, color: 'var(--dim)', marginBottom: 20,
            padding: '10px 14px',
            background: 'rgba(217, 173, 74,0.05)',
            border: '1px solid rgba(217, 173, 74,0.15)',
            borderRadius: 8,
            lineHeight: 1.55,
          }}
        >
          {TABS.find(t => t.key === activeTab)?.desc}
        </motion.div>
      </AnimatePresence>

      {/* ═══════════════ VERIFIED PROJECTS TAB ═══════════════ */}
      {activeTab === 'projects' && (
        <motion.div key="projects-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {statItems.map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(217, 173, 74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="var(--purple)" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="explorer-filters" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="search-bar" style={{ maxWidth: 280, padding: '4px 4px 4px 12px' }}>
              <span className="search-icon"><Search size={13} /></span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, symbol, address…" />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['All', 'ETH', 'BNB', 'Base'] as ChainF[]).map(c => (
                <button key={c} className={`filter-btn${chainFilter === c ? ' active' : ''}`} onClick={() => setChainFilter(c)}>{c}</button>
              ))}
            </div>
            <select value={minScore} onChange={e => setMinScore(Number(e.target.value))}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
              <option value={0}>Any Score</option>
              <option value={60}>60+ Score</option>
              <option value={75}>75+ Score</option>
              <option value={90}>90+ Score</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusF)}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">All Status</option>
              <option value="renounced">Ownership Renounced</option>
              <option value="permanent">Permanent Lock</option>
              <option value="audited">Audited</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dim)', alignSelf: 'center' }}>
              {visible.length} project{visible.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Projects table */}
          <div className="explorer-table-card">
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Project</th>
                    <th>Chain</th>
                    <th>Trust Score</th>
                    <th>TVL Locked</th>
                    <th>Lock %</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p, i) => {
                    const sc  = scoreColor(p.trustScore)
                    const sb  = scoreBg(p.trustScore)
                    const pct = p.lockPct
                    return (
                      <tr key={p.address} onClick={() => navigate(`/project/${p.address}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span style={{ color: i < 3 ? 'var(--purple)' : 'var(--dim)', fontWeight: i < 3 ? 700 : 500, fontSize: 13 }}>
                            {i + 1}
                          </span>
                        </td>
                        <td>
                          <div className="asset-cell">
                            <div className="asset-avatar" style={{ background: '#242018', color: '#f1cb73', fontSize: 13, fontWeight: 700 }}>
                              {p.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="asset-name">{p.name}</div>
                              <div className="asset-dex">{p.symbol} · {p.category}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                            {p.chain}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: sc, minWidth: 28, textAlign: 'right', background: sb, padding: '2px 6px', borderRadius: 5 }}>
                              {p.trustScore}
                            </span>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', minWidth: 50 }}>
                              <div style={{ width: `${p.trustScore}%`, height: '100%', borderRadius: 2, background: sc }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="amt-main">{formatTvl(p.tvlLocked)}</div>
                          <div className="amt-usd">{p.activeLocks} active lock{p.activeLocks !== 1 ? 's' : ''}</div>
                        </td>
                        <td>
                          <div className="pct-wrap">
                            <div className="pct-bar">
                              <div className={`pct-fill ${pct >= 75 ? 'high' : pct >= 50 ? 'medium' : 'low'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="pct-val">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.isPermanent && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)', whiteSpace: 'nowrap' }}>Permanent</span>}
                            {p.isRenounced && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)', whiteSpace: 'nowrap' }}>Renounced</span>}
                            {p.isAudited   && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(103, 199, 144,0.12)',  color: '#8fd6ac',       border: '1px solid rgba(103, 199, 144,0.25)',  whiteSpace: 'nowrap' }}>Audited</span>}
                            {!p.isRenounced && !p.isPermanent && !p.isAudited && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap' }}>Unverified</span>
                            )}
                          </div>
                        </td>
                        <td><ChevronRight size={14} color="var(--dim)" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && (
              <div style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--dim)' }}>No projects match the current filters.</div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════════ ALL LOCKS TAB ═══════════════ */}
      {activeTab === 'locks' && (
        <motion.div key="locks-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

          {/* Filters */}
          <div className="explorer-filters" style={{ marginBottom: 12 }}>
            {LOCK_FILTERS.map(f => (
              <button key={f.key} className={`filter-btn${lockFilter === f.key ? ' active' : ''}`} onClick={() => setLockFilter(f.key)}>
                {f.label}
              </button>
            ))}
            <div className="search-bar" style={{ marginLeft: 'auto', maxWidth: 280, padding: '4px 4px 4px 12px' }}>
              <span className="search-icon"><Search size={13} /></span>
              <input value={lockQuery} onChange={e => setLockQuery(e.target.value)} placeholder="Filter by asset, address…" />
            </div>
          </div>

          {lockError && <div className="form-alert error">{lockError}</div>}

          {/* Locks table */}
          <div className="explorer-table-card">
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Chain</th>
                    <th>Amount</th>
                    <th>Locked Until</th>
                    <th>Lock %</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLocks.map(lock => {
                    const pct = Number(lock.lockedPercentage || 0)
                    return (
                      <tr key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(`/lock/${lock.chainId}/${lock.lockId}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="asset-cell">
                            <div className="asset-avatar" style={{ background: lock.assetType === 'lp' ? '#001840' : '#242018', color: lock.assetType === 'lp' ? '#8fd6ac' : '#f1cb73' }}>
                              {lockName(lock).slice(0, 2)}
                            </div>
                            <div>
                              <div className="asset-name" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); navigate(`/project/${lock.assetAddress}`) }}>
                                {lockName(lock)}
                              </div>
                              <div className="asset-dex">{lock.assetAddress}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={`type-badge ${lock.assetType}`}>{lock.assetType === 'lp' ? 'LP Lock' : 'Token Lock'}</div>
                          <div className="mode-label">{lock.lockType}</div>
                        </td>
                        <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{lock.chainId}</span></td>
                        <td>
                          <div className="amt-main">{formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)}</div>
                          <div className="amt-usd">{formatUsd(lock.tvlUsd)}</div>
                        </td>
                        <td>
                          <div className="date-main">{formatDate(lock.unlockDate)}</div>
                          <div className="days-left">{lock.isPermanent ? 'Withdrawal rights renounced' : lock.lockType}</div>
                        </td>
                        <td>
                          <div className="pct-wrap">
                            <div className="pct-bar"><div className={`pct-fill ${pctClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <span className="pct-val">{lock.lockedPercentage || '-'}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>
                            {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle size={9} /> Active</>}
                          </span>
                        </td>
                        <td><ChevronRight size={14} color="var(--dim)" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(loading || visibleLocks.length === 0) && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dim)' }}>
                {loading ? 'Loading locks…' : 'No indexed locks yet. Create a lock, then run the API indexer.'}
              </div>
            )}
          </div>
        </motion.div>
      )}

    </div>
  )
}
