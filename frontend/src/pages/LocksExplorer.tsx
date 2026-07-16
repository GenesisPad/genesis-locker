import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, FileClock, Infinity, Layers, Lock, Search } from 'lucide-react'
import { api, formatAmount, formatDate, formatUsd, lockAssetLabel, lockProjectName, lockProjectTicker, lockTypeLabel, proofPath, type ApiLock } from '../lib/api'
import { getChainById } from '../lib/chains'

export type LockExplorerFilterKey = 'all' | 'tokens' | 'v2' | 'v3' | 'vesting' | 'timed' | 'permanent' | 'soon'

const FILTERS: Array<{ key: LockExplorerFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'v2', label: 'Liquidity Tokens' },
  { key: 'v3', label: 'Locked Positions' },
  { key: 'vesting', label: 'Vesting' },
  { key: 'timed', label: 'Timed' },
  { key: 'permanent', label: 'Permanent' },
  { key: 'soon', label: 'Unlocking Soon' },
]

function filterArgs(filter: LockExplorerFilterKey) {
  if (filter === 'tokens') return { assetType: 'token' as const }
  if (filter === 'v2') return { assetType: 'lp' as const }
  if (filter === 'v3') return { assetType: 'v3_position' as const }
  if (filter === 'vesting') return { lockType: 'vesting' as const }
  if (filter === 'timed') return { lockType: 'timed' as const }
  if (filter === 'permanent') return { lockType: 'permanent' as const }
  if (filter === 'soon') return { unlockingSoon: true }
  return undefined
}

function positionLabel(lock: ApiLock) {
  if (lock.assetType === 'v3_position') return `Position #${lock.positionTokenId || lock.lockId}`
  return formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)
}

function primaryTitle(lock: ApiLock) {
  if (lock.assetType === 'v3_position') return lockProjectName(lock)
  return lockAssetLabel(lock)
}

function primaryMeta(lock: ApiLock) {
  const chainName = getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`
  if (lock.assetType === 'v3_position') {
    return `${lockProjectTicker(lock)} · ${chainName} · Permanent liquidity position`
  }
  return `${chainName} · ${lockTypeLabel(lock)} · ${lock.isPermanent ? 'Permanent' : lock.lockType === 'vesting' ? 'Vesting' : 'Timed'}`
}

export function LocksExplorer({
  initialFilter = 'all',
  title = 'Explore Locks',
  description = 'Tokens, liquidity locks and launch-created locked positions in one proof surface.',
}: {
  initialFilter?: LockExplorerFilterKey
  title?: string
  description?: string
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<LockExplorerFilterKey>(initialFilter)
  const [query, setQuery] = useState('')
  const [locks, setLocks] = useState<ApiLock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = (showLoading = false) => {
      if (showLoading) setLoading(true)
      setError('')
      api.locks(100, filterArgs(filter))
        .then(response => active && setLocks(response.locks))
        .catch(err => active && setError(err instanceof Error ? err.message : 'Failed to load locks'))
        .finally(() => active && setLoading(false))
    }
    load(true)
    const interval = window.setInterval(() => load(false), filter === 'v3' ? 10_000 : 20_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [filter])

  const visibleLocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return locks
    return locks.filter(lock => [
      lockAssetLabel(lock),
      lock.assetAddress,
      lock.owner,
      lock.beneficiary,
      lock.positionTokenId || '',
      lock.lockId,
      lock.poolAddress || '',
    ].some(value => value.toLowerCase().includes(q)))
  }, [locks, query])

  return (
    <div className="locks-explorer-page">
      <div className="page-heading">
        <h1 className="page-title">{title}</h1>
        <p className="page-desc">{description}</p>
      </div>

      <div className="explorer-toolbar">
        <div className="search-bar compact">
          <span className="search-icon"><Search size={15} /></span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search token, wallet, pool, position ID or lock ID" />
        </div>
        <div className="filter-row" role="tablist" aria-label="Lock filters">
          {FILTERS.map(item => (
            <button key={item.key} type="button" className={`filter-chip${filter === item.key ? ' active' : ''}`} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-alert error">{error}</div>}
      {loading && <div className="form-alert">Loading indexed locks...</div>}

      <div className="lock-result-list">
        {!loading && visibleLocks.length === 0 && (
          <div className="empty-state">No locks match this filter yet.</div>
        )}
        {visibleLocks.map(lock => (
          <button className="lock-result-row" key={`${lock.chainId}-${lock.contractAddress}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))}>
            <div className="lock-result-icon">
              {lock.assetType === 'v3_position' ? <Layers size={17} /> : lock.isPermanent ? <Infinity size={17} /> : lock.lockType === 'vesting' ? <FileClock size={17} /> : <Lock size={17} />}
            </div>
            <div className="lock-result-main">
              <div className="lock-result-title">{primaryTitle(lock)}</div>
              <div className="lock-result-meta">{primaryMeta(lock)}</div>
              <div className="lock-result-meta" style={{ display: 'none' }}>
                {getChainById(lock.chainId)?.name ?? `Chain ${lock.chainId}`} · {lockTypeLabel(lock)} · {lock.isPermanent ? 'Permanent' : lock.lockType === 'vesting' ? 'Vesting' : 'Timed'}
              </div>
            </div>
            <div className="lock-result-stat">
              <span>{positionLabel(lock)}</span>
              <small>{lock.assetType === 'v3_position' ? 'Position number' : lock.unlockDate ? `Unlocks ${formatDate(lock.unlockDate)}` : 'No unlock'}</small>
            </div>
            <div className="lock-result-stat">
              <span>{lock.tvlUsd ? formatUsd(lock.tvlUsd) : 'Unavailable'}</span>
              <small>Estimated locked value</small>
            </div>
            <div className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>
              {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><Clock size={9} /> Active</>}
            </div>
            <ChevronRight size={15} color="var(--dim)" />
          </button>
        ))}
      </div>
    </div>
  )
}
