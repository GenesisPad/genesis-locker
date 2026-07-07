import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import { Clock, ChevronRight, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'
import { api, formatUsd } from '../lib/api'

/* ── Mock data ────────────────────────────────────────────────────────── */

const TVL_DATA = [
  { date: 'Jan', tvl: 48 }, { date: 'Feb', tvl: 54 }, { date: 'Mar', tvl: 61 },
  { date: 'Apr', tvl: 58 }, { date: 'May', tvl: 72 }, { date: 'Jun', tvl: 88 },
  { date: 'Jul', tvl: 95 }, { date: 'Aug', tvl: 102 }, { date: 'Sep', tvl: 98 },
  { date: 'Oct', tvl: 115 }, { date: 'Nov', tvl: 122 }, { date: 'Dec', tvl: 128 },
]

// Daily bars — days 1-31 (May) then days 1-7 (Jun)
const DAILY_LOCK_DATA = [
  { label: 'May 1', count: 82 },  { label: '2',  count: 95  }, { label: '3',  count: 88  },
  { label: '4',  count: 76  }, { label: '5',  count: 103 }, { label: '6',  count: 118 },
  { label: '7',  count: 91  }, { label: '8',  count: 84  }, { label: '9',  count: 97  },
  { label: '10', count: 109 }, { label: '11', count: 86  }, { label: '12', count: 124 },
  { label: '13', count: 93  }, { label: '14', count: 78  }, { label: '15', count: 115 },
  { label: '16', count: 102 }, { label: '17', count: 89  }, { label: '18', count: 134 },
  { label: '19', count: 98  }, { label: '20', count: 112 }, { label: '21', count: 87  },
  { label: '22', count: 128 }, { label: '23', count: 94  }, { label: '24', count: 107 },
  { label: '25', count: 119 }, { label: '26', count: 83  }, { label: '27', count: 142 },
  { label: '28', count: 96  }, { label: '29', count: 108 }, { label: '30', count: 121 },
  { label: '31', count: 89  },
  { label: 'Jun 1', count: 98  }, { label: '2', count: 112 }, { label: '3',  count: 88  },
  { label: '4',  count: 126 }, { label: '5',  count: 103 }, { label: '6',  count: 118 },
  { label: '7',  count: 135 },
]

// Monthly bars — Jan 2025 → Jun 2026
const MONTHLY_LOCK_DATA = [
  { label: "Jan '25", count: 820  }, { label: "Feb '25", count: 1100 }, { label: "Mar '25", count: 1350 },
  { label: "Apr '25", count: 1290 }, { label: "May '25", count: 1580 }, { label: "Jun '25", count: 1920 },
  { label: "Jul '25", count: 2100 }, { label: "Aug '25", count: 2350 }, { label: "Sep '25", count: 2240 },
  { label: "Oct '25", count: 2700 }, { label: "Nov '25", count: 2990 }, { label: "Dec '25", count: 3200 },
  { label: "Jan '26", count: 3280 }, { label: "Feb '26", count: 3420 }, { label: "Mar '26", count: 3180 },
  { label: "Apr '26", count: 3650 }, { label: "May '26", count: 3820 }, { label: "Jun '26", count: 3910 },
]

const UNIQUE_LOCKERS_DATA = [
  { date: 'Jan', wallets: 890 }, { date: 'Feb', wallets: 1120 }, { date: 'Mar', wallets: 1380 },
  { date: 'Apr', wallets: 1580 }, { date: 'May', wallets: 1940 }, { date: 'Jun', wallets: 2280 },
  { date: 'Jul', wallets: 2540 }, { date: 'Aug', wallets: 2810 }, { date: 'Sep', wallets: 2720 },
  { date: 'Oct', wallets: 3010 }, { date: 'Nov', wallets: 3180 }, { date: 'Dec', wallets: 3241 },
]

const LOCK_TYPE_DATA = [
  { date: 'Jan', lp: 32, token: 16 }, { date: 'Feb', lp: 36, token: 18 },
  { date: 'Mar', lp: 41, token: 20 }, { date: 'Apr', lp: 39, token: 19 },
  { date: 'May', lp: 48, token: 24 }, { date: 'Jun', lp: 58, token: 30 },
  { date: 'Jul', lp: 63, token: 32 }, { date: 'Aug', lp: 68, token: 34 },
  { date: 'Sep', lp: 65, token: 33 }, { date: 'Oct', lp: 77, token: 38 },
  { date: 'Nov', lp: 82, token: 40 }, { date: 'Dec', lp: 94, token: 34 },
]

const DURATION_DATA = [
  { bucket: '<30d', count: 312 }, { bucket: '30-90d', count: 1840 },
  { bucket: '3-6mo', count: 3240 }, { bucket: '6m-1yr', count: 5820 },
  { bucket: '1-2yr', count: 4900 }, { bucket: '2yr+', count: 2348 },
  { bucket: 'Perm', count: 4291 },
]

const CHAIN_DONUT = [
  { name: 'Ethereum', value: 68.4, color: '#627EEA' },
  { name: 'BNB Chain', value: 38.2, color: '#F3BA2F' },
  { name: 'Base', value: 22.1, color: '#0052FF' },
]

const UPCOMING_UNLOCKS = [
  { id: 7,  asset: 'UNI / WETH', chain: 'ETH',  type: 'LP',    tvl: '$2.84M', unlockDate: 'Jun 12, 2026', daysLeft: 6  },
  { id: 12, asset: 'SHIB / WETH', chain: 'ETH', type: 'LP',    tvl: '$1.12M', unlockDate: 'Jun 18, 2026', daysLeft: 12 },
  { id: 3,  asset: 'CAKE / BNB', chain: 'BNB',  type: 'LP',    tvl: '$880K',  unlockDate: 'Jun 28, 2026', daysLeft: 22 },
  { id: 19, asset: 'ARB',        chain: 'ETH',  type: 'Token', tvl: '$640K',  unlockDate: 'Jul 3, 2026',  daysLeft: 27 },
  { id: 5,  asset: 'DEGEN',      chain: 'Base', type: 'LP',    tvl: '$480K',  unlockDate: 'Jul 8, 2026',  daysLeft: 32 },
  { id: 22, asset: 'MATIC',      chain: 'ETH',  type: 'Token', tvl: '$310K',  unlockDate: 'Jul 15, 2026', daysLeft: 39 },
]

const PROTOCOL_STATS = [
  { label: 'Current TVL', value: '$128.7M', sub: '+$1.2M today', up: true },
  { label: '7D Change', value: '+$8.4M', sub: '+7.0%', up: true },
  { label: 'ATH', value: '$135.2M', sub: 'Jun 2025', up: null },
  { label: 'LP TVL', value: '$93.6M', sub: '72.7% of total', up: null },
  { label: 'Token TVL', value: '$35.1M', sub: '27.3% of total', up: null },
  { label: 'Active Chains', value: '3', sub: 'ETH · Base · BNB', up: null },
]

/* ── Helpers ──────────────────────────────────────────────────────────── */

const tooltipStyle = {
  background: '#141511', border: '1px solid rgba(221,179,83,0.14)',
  borderRadius: 8, fontSize: 12, color: '#f3efe6',
}

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

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ ...tooltipStyle, padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.payload.color }} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>${d.value}M</div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
        {((d.value / 128.7) * 100).toFixed(1)}% of total TVL
      </div>
    </div>
  )
}

// Custom XAxis tick — shows month markers in purple, filters day numbers
const DayTick = ({ x, y, payload }: any) => {
  const val = payload.value as string
  const isMonthStart = val.includes(' ')
  const num = parseInt(val)
  if (!isMonthStart && num % 7 !== 0) return null
  return (
    <text
      x={x} y={y + 12}
      textAnchor="middle"
      fontSize={isMonthStart ? 10 : 9}
      fontWeight={isMonthStart ? 700 : 400}
      fill={isMonthStart ? '#f1cb73' : '#706d66'}
    >
      {val}
    </text>
  )
}

/* ── Chain Screener token type ─────────────────────────────────────────── */

type CSToken = {
  symbol: string; name: string; chain: string; address: string
  priceUsd: number; marketCapUsd: number; volume24hUsd: number
  liquidityUsd: number; priceChange24h: number; riskLevel: string
}

type LeaderSort = 'tvl' | 'marketCap' | 'volume'

/* ── Page ─────────────────────────────────────────────────────────────── */

type Range = '1M' | '3M' | '6M' | '1Y'
type LockView = 'D' | 'M'

const RANGE_MONTHS: Record<Range, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }

export function Analytics() {
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('1Y')
  const [lockView, setLockView] = useState<LockView>('M')
  const [leaderSort, setLeaderSort] = useState<LeaderSort>('tvl')
  const [csTokens, setCsTokens] = useState<CSToken[]>([])
  const [csLoading, setCsLoading] = useState(true)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.stats>> | null>(null)

  useEffect(() => { api.stats().then(setStats).catch(() => setStats(null)) }, [])

  useEffect(() => {
    fetch('https://api.chainscreener.site/api/tokens')
      .then(r => r.json())
      .then(json => { setCsTokens(json.data || []); setCsLoading(false) })
      .catch(() => setCsLoading(false))
  }, [])

  const n = RANGE_MONTHS[range]
  const tvlData = useMemo(() => TVL_DATA.slice(-n), [n])
  const uniqueLockersData = useMemo(() => UNIQUE_LOCKERS_DATA.slice(-n), [n])
  const lockTypeData = useMemo(() => LOCK_TYPE_DATA.slice(-n), [n])
  const monthlyLockData = useMemo(() => MONTHLY_LOCK_DATA.slice(-Math.max(n, 3)), [n])
  const lockData = lockView === 'D' ? DAILY_LOCK_DATA : monthlyLockData

  const sortedTokens = [...csTokens].sort((a, b) => {
    if (leaderSort === 'tvl') return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)
    if (leaderSort === 'marketCap') return (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0)
    return (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)
  }).slice(0, 10)

  return (
    <div className="analytics-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">TVL & Analytics</h1>
        <p className="page-desc">Real-time protocol metrics across all chains and lock types.</p>
      </motion.div>

      {/* Range Selector */}
      <div className="tab-row" style={{ marginBottom: 20 }}>
        {(['1M', '3M', '6M', '1Y'] as Range[]).map(r => (
          <button key={r} className={`tab-btn${range === r ? ' active' : ''}`} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>

      {/* TVL Chart + Protocol Overview */}
      <motion.div
        className="analytics-overview-grid"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="chart-card">
          <div className="chart-title">Total Value Locked</div>
          <div className="chart-sub">Cumulative TVL across all chains</div>
          <div className="chart-value">{formatUsd(stats?.totalTvl)}</div>
          <div className="chart-trend" style={{ marginBottom: 8 }}>
            {stats ? `${stats.totalLocks} indexed locks` : 'Waiting for indexed data'}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={tvlData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="tvl-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9ad4a" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#d9ad4a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#706d66' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v)}M`, 'TVL']} cursor={{ stroke: 'rgba(217, 173, 74,0.3)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="tvl" stroke="#d9ad4a" strokeWidth={2} fill="url(#tvl-grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Protocol Overview */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="chart-title" style={{ marginBottom: 16 }}>Protocol Overview</div>
          {PROTOCOL_STATS.map(s => (
            <div key={s.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.up === true ? 'var(--success)' : s.up === false ? 'var(--danger)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Charts grid */}
      <div className="analytics-grid">

        {/* Locks Created — bar chart D/M */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div className="chart-title">Locks Created</div>
              <div className="chart-sub">{lockView === 'D' ? 'Daily bars — days of month' : 'Monthly bars — Jan → Dec'}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['D', 'M'] as LockView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setLockView(v)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${lockView === v ? 'rgba(217, 173, 74,0.5)' : 'var(--border)'}`,
                    background: lockView === v ? 'rgba(217, 173, 74,0.12)' : 'transparent',
                    color: lockView === v ? 'var(--accent)' : 'var(--dim)',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-value" style={{ marginBottom: 8 }}>{stats?.totalLocks ?? '18,742'}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={lockData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                tick={lockView === 'D' ? DayTick : { fontSize: 9, fill: '#706d66' }}
                axisLine={false}
                tickLine={false}
                height={20}
              />
              <YAxis tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [(v as number).toLocaleString(), 'Locks']}
                cursor={{ fill: 'rgba(217, 173, 74,0.06)' }}
              />
              <Bar dataKey="count" fill="#67c790" radius={[2, 2, 0, 0]} opacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Lock Duration Distribution */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="chart-title">Lock Duration Distribution</div>
          <div className="chart-sub">How long users choose to lock</div>
          <div className="chart-value">284 days avg</div>
          <div className="chart-trend" style={{ marginBottom: 8 }}>Median: 6m–1yr bucket</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={DURATION_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [(v as number).toLocaleString(), 'Locks']} cursor={{ fill: 'rgba(217, 173, 74,0.08)' }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {DURATION_DATA.map((_, i) => <Cell key={i} fill={i === 6 ? '#f1cb73' : '#d9ad4a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* TVL by Chain donut */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="chart-title">TVL by Chain</div>
          <div className="chart-sub">Distribution across supported networks</div>
          <div className="chart-value">$128.7M</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12 }}>
            <PieChart width={140} height={140}>
              <Pie data={CHAIN_DONUT} cx={70} cy={70} innerRadius={42} outerRadius={64}
                dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                {CHAIN_DONUT.map((entry, i) => <Cell key={i} fill={entry.color} style={{ cursor: 'pointer', outline: 'none' }} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CHAIN_DONUT.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    {c.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>${c.value}M</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* TVL by Lock Type */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <div className="chart-title">TVL by Lock Type</div>
          <div className="chart-sub">LP locks vs token locks over time</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 8, marginTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: '#8fd6ac', display: 'inline-block' }} /> LP Locks
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: '#f1cb73', display: 'inline-block' }} /> Token Locks
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={lockTypeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="lp-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8fd6ac" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8fd6ac" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="token-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f1cb73" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f1cb73" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#706d66' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`$${Number(v)}M`, name === 'lp' ? 'LP Locks' : 'Token Locks']} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="lp" stroke="#8fd6ac" strokeWidth={2} fill="url(#lp-grad)" dot={false} stackId="1" activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="token" stroke="#f1cb73" strokeWidth={2} fill="url(#token-grad)" dot={false} stackId="1" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

      </div>

      {/* Top Locked Assets Leaderboard */}
      <motion.div
        className="chart-card"
        style={{ marginBottom: 16 }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 2 }}>Top Locked Assets</div>
            <div className="chart-sub">Powered by Chain Screener market data</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['tvl', 'TVL'], ['marketCap', 'Market Cap'], ['volume', 'Volume']] as [LeaderSort, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setLeaderSort(key)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${leaderSort === key ? 'rgba(217, 173, 74,0.5)' : 'var(--border)'}`,
                  background: leaderSort === key ? 'rgba(217, 173, 74,0.12)' : 'transparent',
                  color: leaderSort === key ? 'var(--accent)' : 'var(--dim)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {csLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Loading market data from Chain Screener...
          </div>
        ) : sortedTokens.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Unable to reach Chain Screener API
          </div>
        ) : (
          <div className="tbl-wrapper">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Token</th>
                <th>Chain</th>
                <th>Price</th>
                <th>Market Cap</th>
                <th>24h Volume</th>
                <th>Liquidity (TVL)</th>
                <th>24h</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {sortedTokens.map((t, i) => {
                const pct = t.priceChange24h * 100
                const isUp = pct >= 0
                return (
                  <tr key={t.address} style={{ cursor: 'pointer' }} onClick={() => t.address && navigate(`/project/${t.address}`)}>
                    <td style={{ color: 'var(--dim)', fontSize: 12, fontWeight: 600, width: 28 }}>{i + 1}</td>
                    <td>
                      <div className="asset-cell">
                        <div className="asset-avatar" style={{ background: 'rgba(217, 173, 74,0.12)', color: 'var(--accent)', fontSize: 9 }}>
                          {t.symbol?.slice(0, 3) ?? '??'}
                        </div>
                        <div>
                          <div className="asset-name">{t.symbol}</div>
                          <div className="asset-dex" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                        background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', textTransform: 'uppercase',
                      }}>{t.chain}</span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600 }}>
                      {t.priceUsd < 0.001 ? t.priceUsd.toExponential(2) : `$${t.priceUsd.toFixed(t.priceUsd < 1 ? 4 : 2)}`}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{fmt(t.marketCapUsd, '$')}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{fmt(t.volume24hUsd, '$')}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>
                      {fmt(t.liquidityUsd, '$')}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isUp ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {isUp ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
                        background: t.riskLevel === 'Low' ? 'rgba(34,197,94,0.1)' : t.riskLevel === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color: t.riskLevel === 'Low' ? 'var(--success)' : t.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--danger)',
                        border: `1px solid ${t.riskLevel === 'Low' ? 'rgba(34,197,94,0.2)' : t.riskLevel === 'Medium' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {t.riskLevel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </motion.div>

      {/* Unique Lockers + Upcoming Unlocks */}
      <div className="analytics-bottom-grid">

        {/* Unique Lockers */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <div className="chart-title">Unique Lockers</div>
          <div className="chart-sub">Distinct wallets that have locked</div>
          <div className="chart-value">3,241</div>
          <div className="chart-trend">+5.82% this month</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={uniqueLockersData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#706d66' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Wallets']} cursor={{ stroke: 'rgba(34,197,94,0.3)', strokeWidth: 1 }} />
              <Line type="monotone" dataKey="wallets" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Upcoming Unlocks */}
        <motion.div
          className="chart-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div className="chart-title" style={{ marginBottom: 2 }}>Upcoming Unlocks</div>
              <div className="chart-sub">Next 90 days</div>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)' }}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {UPCOMING_UNLOCKS.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
              }}>
                <div className="asset-avatar" style={{ background: 'rgba(217, 173, 74,0.1)', color: 'var(--accent)', fontSize: 9, width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}>
                  {u.asset.slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.asset}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={9} /> {u.unlockDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{u.tvl}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: urgencyColor(u.daysLeft),
                    background: `${urgencyColor(u.daysLeft)}18`,
                    padding: '1px 6px', borderRadius: 3,
                    border: `1px solid ${urgencyColor(u.daysLeft)}40`,
                  }}>
                    {u.daysLeft}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

    </div>
  )
}
