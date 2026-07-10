import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, TrendingUp, Lock,
  Layers, Infinity, CheckCircle, Coins,
} from 'lucide-react'
import { ApiLock, api, formatAmount, formatDate, formatUsd } from '../lib/api'
import { getChainById } from '../lib/chains'

// ─── shared helpers ────────────────────────────────────────────────────────

type ChainF   = 'All' | number
type LockFilter = 'all' | 'lp' | 'token' | 'cliff' | 'vesting' | 'permanent'

function formatTvl(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function pctClass(p: number) { return p >= 75 ? 'high' : p >= 50 ? 'medium' : 'low' }
function lockName(lock: ApiLock) {
  return lock.token?.symbol || `${lock.assetAddress.slice(0, 6)}…${lock.assetAddress.slice(-4)}`
}

// ─── asset grouping (derived from real locks, no fabricated data) ─────────

type AssetGroup = {
  assetAddress: string
  chainId: number
  assetType: 'lp' | 'token'
  name: string
  symbol: string
  totalTvlUsd: number
  totalLockedPct: number
  activeLocks: number
  isPermanent: boolean
  hasMintRisk: boolean
  hasHighTaxRisk: boolean
  hasBlacklistRisk: boolean
}

function groupByAsset(locks: ApiLock[]): AssetGroup[] {
  const map = new Map<string, AssetGroup>()
  for (const lock of locks) {
    const key = `${lock.chainId}-${lock.assetAddress.toLowerCase()}`
    const existing = map.get(key)
    const tvl = Number(lock.tvlUsd || 0)
    const pct = Number(lock.lockedPercentage || 0)
    if (existing) {
      existing.totalTvlUsd += Number.isFinite(tvl) ? tvl : 0
      existing.totalLockedPct = Math.min(100, existing.totalLockedPct + (Number.isFinite(pct) ? pct : 0))
      existing.activeLocks += 1
      if (lock.isPermanent) existing.isPermanent = true
      if (lock.token?.hasMintRisk) existing.hasMintRisk = true
      if (lock.token?.hasHighTaxRisk) existing.hasHighTaxRisk = true
      if (lock.token?.hasBlacklistRisk) existing.hasBlacklistRisk = true
    } else {
      map.set(key, {
        assetAddress: lock.assetAddress,
        chainId: lock.chainId,
        assetType: lock.assetType,
        name: lock.token?.name || lockName(lock),
        symbol: lock.token?.symbol || lockName(lock),
        totalTvlUsd: Number.isFinite(tvl) ? tvl : 0,
        totalLockedPct: Math.min(100, Number.isFinite(pct) ? pct : 0),
        activeLocks: 1,
        isPermanent: lock.isPermanent,
        hasMintRisk: !!lock.token?.hasMintRisk,
        hasHighTaxRisk: !!lock.token?.hasHighTaxRisk,
        hasBlacklistRisk: !!lock.token?.hasBlacklistRisk,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.totalTvlUsd - a.totalTvlUsd)
}

// ─── tab definitions ────────────────────────────────────────────────────────

const TABS = [
  {
    key: 'assets',
    label: 'Locked Assets',
    icon: Coins,
    desc: 'Every token and LP pair with at least one lock on Genesis Locker, ranked by total value locked — derived live from on-chain lock data.',
  },
  {
    key: 'locks',
    label: 'All Locks',
    icon: Layers,
    desc: 'Raw ledger of every lock created on Genesis Locker, across all chains and asset types.',
  },
] as const
type TabKey = typeof TABS[number]['key']

// ─── component ─────────────────────────────────────────────────────────────

export function Projects() {
  const navigate      = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeTab     = (params.get('tab') === 'locks' ? 'locks' : 'assets') as TabKey

  function setTab(key: TabKey) {
    if (key === 'assets') {
      setParams({})
    } else {
      setParams({ tab: key })
    }
  }

  const [locks,      setLocks]      = useState<ApiLock[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState('')

  useEffect(() => {
    api.locks(200)
      .then(r  => setLocks(r.locks))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load locks'))
      .finally(() => setLoading(false))
  }, [])

  // ── Assets tab state ──
  const [query,        setQuery]        = useState('')
  const [chainFilter,  setChainFilter]  = useState<ChainF>('All')

  const assetGroups = useMemo(() => groupByAsset(locks), [locks])
  const chainOptions = useMemo(() => {
    const ids = [...new Set(locks.map(l => l.chainId))]
    return ids.map(id => ({ id, name: getChainById(id)?.name || `Chain ${id}` }))
  }, [locks])

  const visible = useMemo(() => {
    return assetGroups.filter(a => {
      if (chainFilter !== 'All' && a.chainId !== chainFilter) return false
      if (query) {
        const q = query.toLowerCase()
        return a.name.toLowerCase().includes(q) ||
               a.symbol.toLowerCase().includes(q) ||
               a.assetAddress.toLowerCase().includes(q)
      }
      return true
    })
  }, [assetGroups, query, chainFilter])

  const totalTvl    = assetGroups.reduce((s, a) => s + a.totalTvlUsd, 0)
  const permanentCount = assetGroups.filter(a => a.isPermanent).length

  const statItems = [
    { icon: Coins,      label: 'Assets Locked',    value: String(assetGroups.length) },
    { icon: TrendingUp, label: 'Total TVL Locked', value: formatTvl(totalTvl) },
    { icon: Lock,       label: 'Permanently Locked', value: String(permanentCount) },
  ]

  // ── Locks tab state ──
  const [lockFilter, setLockFilter] = useState<LockFilter>('all')
  const [lockQuery,  setLockQuery]  = useState('')

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
          Browse locked assets ranked by value, or search the raw ledger of every on-chain lock.
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
              borderBottom: `2px solid ${activeTab === key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <Icon size={13} color={activeTab === key ? 'var(--accent)' : 'var(--dim)'} />
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
            background: 'rgba(213, 253, 81,0.05)',
            border: '1px solid rgba(213, 253, 81,0.15)',
            borderRadius: 8,
            lineHeight: 1.55,
          }}
        >
          {TABS.find(t => t.key === activeTab)?.desc}
        </motion.div>
      </AnimatePresence>

      {loadError && <div className="form-alert error">{loadError}</div>}

      {/* ═══════════════ LOCKED ASSETS TAB ═══════════════ */}
      {activeTab === 'assets' && (
        <motion.div key="assets-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {statItems.map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(213, 253, 81,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="var(--accent)" />
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
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button className={`filter-btn${chainFilter === 'All' ? ' active' : ''}`} onClick={() => setChainFilter('All')}>All</button>
              {chainOptions.map(c => (
                <button key={c.id} className={`filter-btn${chainFilter === c.id ? ' active' : ''}`} onClick={() => setChainFilter(c.id)}>{c.name}</button>
              ))}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dim)', alignSelf: 'center' }}>
              {visible.length} asset{visible.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Assets table */}
          <div className="explorer-table-card">
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Asset</th>
                    <th>Chain</th>
                    <th>Type</th>
                    <th>TVL Locked</th>
                    <th>Lock %</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a, i) => {
                    const pct = a.totalLockedPct
                    const chainCfg = getChainById(a.chainId)
                    return (
                      <tr key={`${a.chainId}-${a.assetAddress}`} onClick={() => navigate(`/project/${a.assetAddress}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span style={{ color: i < 3 ? 'var(--accent)' : 'var(--dim)', fontWeight: i < 3 ? 700 : 500, fontSize: 13 }}>
                            {i + 1}
                          </span>
                        </td>
                        <td>
                          <div className="asset-cell">
                            <div className="asset-avatar" style={{ background: a.assetType === 'lp' ? '#001840' : '#141a10', color: a.assetType === 'lp' ? '#8fd6ac' : '#e5feaa', fontSize: 13, fontWeight: 700 }}>
                              {a.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="asset-name">{a.name}</div>
                              <div className="asset-dex">{a.assetAddress.slice(0, 8)}…{a.assetAddress.slice(-6)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                            {chainCfg?.name || a.chainId}
                          </span>
                        </td>
                        <td>
                          <div className={`type-badge ${a.assetType}`}>{a.assetType === 'lp' ? 'LP' : 'Token'}</div>
                        </td>
                        <td>
                          <div className="amt-main">{formatTvl(a.totalTvlUsd)}</div>
                          <div className="amt-usd">{a.activeLocks} lock{a.activeLocks !== 1 ? 's' : ''}</div>
                        </td>
                        <td>
                          <div className="pct-wrap">
                            <div className="pct-bar">
                              <div className={`pct-fill ${pctClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="pct-val">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {a.isPermanent && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)', whiteSpace: 'nowrap' }}>Permanent</span>}
                            {a.hasMintRisk && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap' }}>Mint Risk</span>}
                            {a.hasHighTaxRisk && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(225,183,92,0.1)', color: 'var(--warning)', border: '1px solid rgba(225,183,92,0.2)', whiteSpace: 'nowrap' }}>High Tax</span>}
                            {a.hasBlacklistRisk && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap' }}>Blacklist</span>}
                            {!a.isPermanent && !a.hasMintRisk && !a.hasHighTaxRisk && !a.hasBlacklistRisk && (
                              <span style={{ fontSize: 10, color: 'var(--dim)' }}>—</span>
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
            {(loading || visible.length === 0) && (
              <div style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--dim)' }}>
                {loading ? 'Loading assets…' : 'No locked assets yet — be the first to lock on Genesis Locker.'}
              </div>
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
                            <div className="asset-avatar" style={{ background: lock.assetType === 'lp' ? '#001840' : '#141a10', color: lock.assetType === 'lp' ? '#8fd6ac' : '#e5feaa' }}>
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
                        <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{getChainById(lock.chainId)?.name || lock.chainId}</span></td>
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
