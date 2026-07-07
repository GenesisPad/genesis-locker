import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { Clock, ChevronRight, Layers, Coins, Lock, Infinity, Users, TrendingUp } from 'lucide-react'
import { ApiLock, api, formatUsd, GlobalStats } from '../lib/api'
import { getChainById } from '../lib/chains'

/* ── Helpers ──────────────────────────────────────────────────────────── */

const tooltipStyle = {
  background: '#141511', border: '1px solid rgba(221,179,83,0.14)',
  borderRadius: 8, fontSize: 12, color: '#f3efe6',
}

const CHAIN_DOT_COLORS = ['#d9ad4a', '#627EEA', '#0052FF', '#F3BA2F', '#22c55e']

function urgencyColor(days: number) {
  if (days <= 7) return 'var(--danger)'
  if (days <= 30) return 'var(--warning)'
  return 'var(--muted)'
}

function fmt(n: number, prefix = '') {
  if (n >= 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`
  return `${prefix}${n.toFixed(2)}`
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function assetLabel(lock: ApiLock) {
  return lock.token?.symbol || lock.token?.name || `${lock.assetAddress.slice(0, 6)}...${lock.assetAddress.slice(-4)}`
}

// Real duration buckets derived from each lock's own start/unlock dates.
const DURATION_BUCKETS = ['<30d', '30-90d', '3-6mo', '6m-1yr', '1-2yr', '2yr+', 'Permanent'] as const

function durationBucket(lock: ApiLock): typeof DURATION_BUCKETS[number] {
  if (lock.isPermanent || !lock.unlockDate) return 'Permanent'
  const days = (new Date(lock.unlockDate).getTime() - new Date(lock.startDate).getTime()) / 864e5
  if (days < 30) return '<30d'
  if (days < 90) return '30-90d'
  if (days < 180) return '3-6mo'
  if (days < 365) return '6m-1yr'
  if (days < 730) return '1-2yr'
  return '2yr+'
}

type AssetRow = {
  assetAddress: string
  chainId: number
  assetType: 'lp' | 'token'
  symbol: string
  tvlUsd: number
  lockCount: number
}

function topAssets(locks: ApiLock[]): AssetRow[] {
  const map = new Map<string, AssetRow>()
  for (const lock of locks) {
    const key = `${lock.chainId}-${lock.assetAddress.toLowerCase()}`
    const tvl = Number(lock.tvlUsd || 0)
    const existing = map.get(key)
    if (existing) {
      existing.tvlUsd += Number.isFinite(tvl) ? tvl : 0
      existing.lockCount += 1
    } else {
      map.set(key, {
        assetAddress: lock.assetAddress,
        chainId: lock.chainId,
        assetType: lock.assetType,
        symbol: assetLabel(lock),
        tvlUsd: Number.isFinite(tvl) ? tvl : 0,
        lockCount: 1,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.tvlUsd - a.tvlUsd)
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ ...tooltipStyle, padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.payload.color }} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{formatUsd(String(d.value))}</div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function Analytics() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [locks, setLocks] = useState<ApiLock[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null))
    api.locks(200).then(r => setLocks(r.locks)).catch(() => setLocks([])).finally(() => setLoaded(true))
  }, [])

  const chainDonut = useMemo(() => {
    if (!stats) return []
    return stats.byChain
      .map((c, i) => ({ name: c.name, value: Number(c.totalTvl || 0), color: CHAIN_DOT_COLORS[i % CHAIN_DOT_COLORS.length] }))
      .filter(c => c.value > 0)
  }, [stats])

  const durationData = useMemo(() => {
    const counts = Object.fromEntries(DURATION_BUCKETS.map(b => [b, 0])) as Record<string, number>
    for (const lock of locks) counts[durationBucket(lock)]++
    return DURATION_BUCKETS.map(bucket => ({ bucket, count: counts[bucket] }))
  }, [locks])

  const assetTypeData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'LP Locks', value: Number(stats.totalLpTvl || 0), color: '#8fd6ac' },
      { name: 'Token Locks', value: Number(stats.totalTokenTvl || 0), color: '#f1cb73' },
    ].filter(d => d.value > 0)
  }, [stats])

  const leaderboard = useMemo(() => topAssets(locks).slice(0, 10), [locks])

  const upcomingUnlocks = useMemo(() => locks
    .filter(l => !l.isPermanent && l.unlockDate && daysUntil(l.unlockDate)! >= 0)
    .sort((a, b) => new Date(a.unlockDate!).getTime() - new Date(b.unlockDate!).getTime())
    .slice(0, 6), [locks])

  const overviewStats = stats ? [
    { label: 'Current TVL', value: formatUsd(stats.totalTvl), icon: Layers },
    { label: 'LP TVL', value: formatUsd(stats.totalLpTvl), icon: TrendingUp },
    { label: 'Token TVL', value: formatUsd(stats.totalTokenTvl), icon: Coins },
    { label: 'Total Locks', value: (stats.totalLocks ?? 0).toLocaleString(), icon: Lock },
    { label: 'Permanent Locks', value: (stats.totalPermanentLocks ?? 0).toLocaleString(), icon: Infinity },
    { label: 'Unique Lockers', value: (stats.uniqueLockers ?? 0).toLocaleString(), icon: Users },
  ] : []

  return (
    <div className="analytics-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">TVL & Analytics</h1>
        <p className="page-desc">Live protocol metrics across all chains and lock types, read directly from indexed on-chain locks.</p>
      </motion.div>

      {/* Protocol Overview */}
      <motion.div
        className="chart-card"
        style={{ marginBottom: 16 }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="chart-title" style={{ marginBottom: 14 }}>Protocol Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {stats ? overviewStats.map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(217, 173, 74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={13} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 1 }}>{label}</div>
              </div>
            </div>
          )) : (
            <div style={{ gridColumn: '1 / -1', color: 'var(--dim)', fontSize: 13, padding: '8px 0' }}>Loading protocol stats…</div>
          )}
        </div>
      </motion.div>

      {/* Charts grid */}
      <div className="analytics-grid">

        {/* Lock Duration Distribution */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="chart-title">Lock Duration Distribution</div>
          <div className="chart-sub">How long locked assets run, by bucket</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={durationData} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [(v as number).toLocaleString(), 'Locks']} cursor={{ fill: 'rgba(217, 173, 74,0.08)' }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {durationData.map((d, i) => <Cell key={i} fill={d.bucket === 'Permanent' ? '#f1cb73' : '#d9ad4a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {loaded && locks.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 12, marginTop: 8 }}>No locks indexed yet.</div>
          )}
        </motion.div>

        {/* TVL by Chain donut */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="chart-title">TVL by Chain</div>
          <div className="chart-sub">Distribution across supported networks</div>
          {chainDonut.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No TVL indexed yet.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12 }}>
              <PieChart width={140} height={140}>
                <Pie data={chainDonut} cx={70} cy={70} innerRadius={42} outerRadius={64}
                  dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {chainDonut.map((entry, i) => <Cell key={i} fill={entry.color} style={{ cursor: 'pointer', outline: 'none' }} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chainDonut.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      {c.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.value, '$')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* TVL by Asset Type */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="chart-title">TVL by Asset Type</div>
          <div className="chart-sub">LP locks vs token locks</div>
          {assetTypeData.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No TVL indexed yet.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12 }}>
              <PieChart width={140} height={140}>
                <Pie data={assetTypeData} cx={70} cy={70} innerRadius={42} outerRadius={64}
                  dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {assetTypeData.map((entry, i) => <Cell key={i} fill={entry.color} style={{ cursor: 'pointer', outline: 'none' }} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {assetTypeData.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      {c.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.value, '$')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

      </div>

      {/* Top Locked Assets Leaderboard */}
      <motion.div
        className="chart-card"
        style={{ marginBottom: 16 }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 2 }}>Top Locked Assets</div>
            <div className="chart-sub">Ranked by total value locked on Genesis Locker</div>
          </div>
        </div>

        {!loaded ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Loading…</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            No locks with priced TVL yet.
          </div>
        ) : (
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Asset</th>
                  <th>Chain</th>
                  <th>Type</th>
                  <th>Locks</th>
                  <th>TVL Locked</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((a, i) => (
                  <tr key={`${a.chainId}-${a.assetAddress}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${a.assetAddress}`)}>
                    <td style={{ color: 'var(--dim)', fontSize: 12, fontWeight: 600, width: 28 }}>{i + 1}</td>
                    <td>
                      <div className="asset-cell">
                        <div className="asset-avatar" style={{ background: a.assetType === 'lp' ? '#001840' : '#242018', color: a.assetType === 'lp' ? '#8fd6ac' : '#f1cb73', fontSize: 10 }}>
                          {a.symbol.slice(0, 3)}
                        </div>
                        <div className="asset-name">{a.symbol}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                        {getChainById(a.chainId)?.name || a.chainId}
                      </span>
                    </td>
                    <td><div className={`type-badge ${a.assetType}`}>{a.assetType === 'lp' ? 'LP' : 'Token'}</div></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{a.lockCount}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>{fmt(a.tvlUsd, '$')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Upcoming Unlocks */}
      <motion.div
        className="chart-card"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 2 }}>Upcoming Unlocks</div>
            <div className="chart-sub">Next scheduled unlocks across all chains</div>
          </div>
          <button onClick={() => navigate('/calendar')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            View calendar <ChevronRight size={12} />
          </button>
        </div>
        {loaded && upcomingUnlocks.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No upcoming unlocks.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {upcomingUnlocks.map(lock => {
              const days = daysUntil(lock.unlockDate)!
              return (
                <div key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(`/lock/${lock.chainId}/${lock.lockId}`)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                }}>
                  <div className="asset-avatar" style={{ background: 'rgba(217, 173, 74,0.1)', color: 'var(--accent)', fontSize: 9, width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}>
                    {assetLabel(lock).slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{assetLabel(lock)}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} /> {new Date(lock.unlockDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{formatUsd(lock.tvlUsd)}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: urgencyColor(days),
                      background: `${urgencyColor(days)}18`,
                      padding: '1px 6px', borderRadius: 3,
                      border: `1px solid ${urgencyColor(days)}40`,
                    }}>
                      {days}d
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

    </div>
  )
}
