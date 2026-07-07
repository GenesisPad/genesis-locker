import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { Lock, Infinity, ChevronRight, CheckCircle, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { ApiLock, api, formatAmount, formatDate, formatUsd } from '../lib/api'
import { CHAIN_CONFIGS } from '../lib/chains'
import { parseMetadataURI } from '../lib/metadata'

export function Dashboard() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [locks, setLocks] = useState<ApiLock[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setLocks([])
    setError('')
    if (!address) return
    Promise.all(CHAIN_CONFIGS.map(c => api.walletLocks(c.id, address).catch(() => ({ locks: [] as ApiLock[] }))))
      .then(results => setLocks(results.flatMap(result => result.locks)))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load wallet locks'))
  }, [address])

  const portfolio = useMemo(() => {
    const tvl = locks.reduce((sum, lock) => sum + Number(lock.tvlUsd || 0), 0).toString()
    const permanent = locks.filter(lock => lock.isPermanent).length
    return [
      { label: 'Total Locked Value', val: formatUsd(tvl), color: 'var(--text)' },
      { label: 'Active Locks', val: String(locks.length - permanent), color: 'var(--success)' },
      { label: 'Permanent Locks', val: String(permanent), color: 'var(--accent)' },
      { label: 'Wallet', val: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected', color: 'var(--accent-alt)' },
    ]
  }, [locks, address])

  return (
    <div className="dashboard-page">
      <motion.div className="page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-desc">Your lock portfolio and on-chain activity.</p>
      </motion.div>

      {error && <div className="form-alert error">{error}</div>}

      <div className="dashboard-stats-grid">
        {portfolio.map((item, i) => (
          <motion.div key={item.label} className="dash-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--dim)', marginBottom: 10 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.val}</div>
          </motion.div>
        ))}
      </div>

      <div className="dashboard-grid">
        <motion.div className="dash-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="dash-card-title">My Locks</div>
            <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => navigate('/create')}>
              <Plus size={12} /> New Lock
            </button>
          </div>

          {locks.length === 0 && <div className="text-dim">{isConnected ? 'No indexed locks for this wallet yet.' : 'Connect your wallet from the top bar to view your locks.'}</div>}
          {locks.map(lock => {
            const logo = parseMetadataURI(lock.metadataURI)?.logo
            return (
            <div className="dash-lock-row" key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(`/lock/${lock.chainId}/${lock.lockId}`)} style={{ cursor: 'pointer' }}>
              {logo ? (
                <img src={logo} alt="" className="asset-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="asset-avatar" style={{ background: lock.assetType === 'lp' ? '#001840' : '#242018', color: lock.assetType === 'lp' ? '#8fd6ac' : '#f1cb73' }}>
                  {(lock.token?.symbol || lock.assetAddress).slice(0, 2)}
                </div>
              )}
              <div className="dash-lock-info">
                <div className="dash-lock-name">{lock.token?.symbol || lock.assetAddress}</div>
                <div className="dash-lock-meta">{lock.assetType.toUpperCase()} · {lock.lockType} · {formatDate(lock.unlockDate)}</div>
              </div>
              <div className="dash-lock-right">
                <div className="dash-lock-val">{formatUsd(lock.tvlUsd)}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)}</div>
              </div>
              <span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`} style={{ flexShrink: 0 }}>
                {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle size={9} /> Active</>}
              </span>
              <ChevronRight size={13} color="var(--dim)" />
            </div>
            )
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="dash-card">
            <div className="dash-card-title" style={{ marginBottom: 12 }}>Quick Actions</div>
            {[
              { label: 'Create LP Lock', sub: 'Lock DEX LP tokens', to: '/create', color: 'var(--accent)' },
              { label: 'Create Token Lock', sub: 'Lock ERC-20 tokens', to: '/create', color: 'var(--accent-alt)' },
              { label: 'Browse All Locks', sub: 'Explore indexed locks', to: '/locks', color: 'var(--muted)' },
              { label: 'View Analytics', sub: 'TVL and chain stats', to: '/analytics', color: 'var(--success)' },
            ].map(action => (
              <div key={action.label} className="dash-lock-row" style={{ cursor: 'pointer', paddingLeft: 0, paddingRight: 0 }} onClick={() => navigate(action.to)}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${action.color}18`, border: `1px solid ${action.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={13} color={action.color} />
                </div>
                <div className="dash-lock-info"><div className="dash-lock-name">{action.label}</div><div className="dash-lock-meta">{action.sub}</div></div>
                <ChevronRight size={13} color="var(--dim)" />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
