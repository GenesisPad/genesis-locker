import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, List, Clock, ExternalLink, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type CalendarUnlock = {
  id: string
  asset: string
  symbol: string
  chain: 'ETH' | 'BNB' | 'Base'
  type: 'LP' | 'Token'
  tvl: number
  unlockDate: Date
  lockPct: number
  isPermanent: boolean
}

const CHAIN_COLOR: Record<string, string> = {
  ETH: '#627EEA', BNB: '#F3BA2F', Base: '#0052FF',
}

const raw: CalendarUnlock[] = [
  { id: '7',  asset: 'UNI / WETH',    symbol: 'UNI',   chain: 'ETH',  type: 'LP',    tvl: 2840000, unlockDate: new Date('2026-06-12'), lockPct: 100, isPermanent: false },
  { id: '14', asset: 'PEPE',          symbol: 'PEPE',  chain: 'ETH',  type: 'Token', tvl: 940000,  unlockDate: new Date('2026-06-15'), lockPct: 78,  isPermanent: false },
  { id: '12', asset: 'SHIB / WETH',   symbol: 'SHIB',  chain: 'ETH',  type: 'LP',    tvl: 1120000, unlockDate: new Date('2026-06-18'), lockPct: 95,  isPermanent: false },
  { id: '31', asset: 'BRETT',         symbol: 'BRETT', chain: 'Base', type: 'Token', tvl: 620000,  unlockDate: new Date('2026-06-20'), lockPct: 60,  isPermanent: false },
  { id: '3',  asset: 'CAKE / BNB',    symbol: 'CAKE',  chain: 'BNB',  type: 'LP',    tvl: 880000,  unlockDate: new Date('2026-06-28'), lockPct: 100, isPermanent: false },
  { id: '19', asset: 'ARB',           symbol: 'ARB',   chain: 'ETH',  type: 'Token', tvl: 640000,  unlockDate: new Date('2026-07-03'), lockPct: 45,  isPermanent: false },
  { id: '5',  asset: 'DEGEN / WETH',  symbol: 'DEGEN', chain: 'Base', type: 'LP',    tvl: 480000,  unlockDate: new Date('2026-07-08'), lockPct: 82,  isPermanent: false },
  { id: '22', asset: 'MATIC',         symbol: 'MATIC', chain: 'ETH',  type: 'Token', tvl: 310000,  unlockDate: new Date('2026-07-15'), lockPct: 30,  isPermanent: false },
  { id: '8',  asset: 'LINK / USDC',   symbol: 'LINK',  chain: 'ETH',  type: 'LP',    tvl: 1860000, unlockDate: new Date('2026-07-19'), lockPct: 100, isPermanent: false },
  { id: '41', asset: 'FLOKI',         symbol: 'FLOKI', chain: 'BNB',  type: 'Token', tvl: 230000,  unlockDate: new Date('2026-07-22'), lockPct: 55,  isPermanent: false },
  { id: '9',  asset: 'AAVE / WETH',   symbol: 'AAVE',  chain: 'ETH',  type: 'LP',    tvl: 3200000, unlockDate: new Date('2026-07-30'), lockPct: 100, isPermanent: false },
  { id: '17', asset: 'MEME',          symbol: 'MEME',  chain: 'ETH',  type: 'Token', tvl: 180000,  unlockDate: new Date('2026-08-04'), lockPct: 70,  isPermanent: false },
  { id: '24', asset: 'TOSHI / WETH',  symbol: 'TOSHI', chain: 'Base', type: 'LP',    tvl: 540000,  unlockDate: new Date('2026-08-10'), lockPct: 90,  isPermanent: false },
  { id: '33', asset: 'BONK',          symbol: 'BONK',  chain: 'ETH',  type: 'Token', tvl: 410000,  unlockDate: new Date('2026-08-14'), lockPct: 65,  isPermanent: false },
  { id: '11', asset: 'WBTC / USDC',   symbol: 'WBTC',  chain: 'ETH',  type: 'LP',    tvl: 4800000, unlockDate: new Date('2026-08-21'), lockPct: 100, isPermanent: false },
  { id: '28', asset: 'BANANA / BNB',  symbol: 'BNB',   chain: 'BNB',  type: 'LP',    tvl: 290000,  unlockDate: new Date('2026-08-28'), lockPct: 80,  isPermanent: false },
  { id: '15', asset: 'LDO',           symbol: 'LDO',   chain: 'ETH',  type: 'Token', tvl: 730000,  unlockDate: new Date('2026-09-05'), lockPct: 40,  isPermanent: false },
  { id: '38', asset: 'VIRTUAL / ETH', symbol: 'VIRT',  chain: 'Base', type: 'LP',    tvl: 1420000, unlockDate: new Date('2026-09-12'), lockPct: 100, isPermanent: false },
  { id: '42', asset: 'TRUMP',         symbol: 'TRUMP', chain: 'ETH',  type: 'Token', tvl: 920000,  unlockDate: new Date('2026-09-18'), lockPct: 52,  isPermanent: false },
  { id: '6',  asset: 'CRV / USDT',    symbol: 'CRV',   chain: 'ETH',  type: 'LP',    tvl: 2100000, unlockDate: new Date('2026-09-25'), lockPct: 100, isPermanent: false },
  { id: '45', asset: 'DOGS / BNB',    symbol: 'DOGS',  chain: 'BNB',  type: 'LP',    tvl: 160000,  unlockDate: new Date('2026-10-02'), lockPct: 70,  isPermanent: false },
  { id: '20', asset: 'OP',            symbol: 'OP',    chain: 'ETH',  type: 'Token', tvl: 580000,  unlockDate: new Date('2026-10-10'), lockPct: 35,  isPermanent: false },
  { id: '13', asset: 'MKR / WETH',    symbol: 'MKR',   chain: 'ETH',  type: 'LP',    tvl: 1670000, unlockDate: new Date('2026-10-18'), lockPct: 100, isPermanent: false },
  { id: '50', asset: 'ZORA',          symbol: 'ZORA',  chain: 'Base', type: 'Token', tvl: 340000,  unlockDate: new Date('2026-10-25'), lockPct: 80,  isPermanent: false },
  { id: '27', asset: 'BNB / BUSD',    symbol: 'BNB',   chain: 'BNB',  type: 'LP',    tvl: 2900000, unlockDate: new Date('2026-11-01'), lockPct: 100, isPermanent: false },
  { id: '35', asset: 'WIF',           symbol: 'WIF',   chain: 'ETH',  type: 'Token', tvl: 480000,  unlockDate: new Date('2026-11-08'), lockPct: 60,  isPermanent: false },
  { id: '16', asset: 'UNI / USDC',    symbol: 'UNI',   chain: 'ETH',  type: 'LP',    tvl: 3100000, unlockDate: new Date('2026-11-15'), lockPct: 100, isPermanent: false },
  { id: '48', asset: 'HIGHER',        symbol: 'HIGH',  chain: 'Base', type: 'Token', tvl: 210000,  unlockDate: new Date('2026-11-22'), lockPct: 75,  isPermanent: false },
  { id: '18', asset: 'ETH / USDT',    symbol: 'ETH',   chain: 'ETH',  type: 'LP',    tvl: 7400000, unlockDate: new Date('2026-12-05'), lockPct: 100, isPermanent: false },
  { id: '53', asset: 'SAFE',          symbol: 'SAFE',  chain: 'ETH',  type: 'Token', tvl: 660000,  unlockDate: new Date('2026-12-12'), lockPct: 50,  isPermanent: false },
]

function fmtTvl(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function daysUntil(d: Date) {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000))
}

function urgencyColor(days: number) {
  if (days <= 7) return 'var(--danger)'
  if (days <= 30) return 'var(--warning)'
  return 'var(--muted)'
}

function groupByMonth(items: CalendarUnlock[]) {
  const map = new Map<string, CalendarUnlock[]>()
  for (const item of items) {
    const key = item.unlockDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

export function UnlockCalendar() {
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [chain, setChain] = useState<'all' | 'ETH' | 'BNB' | 'Base'>('all')
  const [type, setType] = useState<'all' | 'LP' | 'Token'>('all')
  const [minTvl, setMinTvl] = useState(0)

  const filtered = useMemo(() => raw
    .filter(u => chain === 'all' || u.chain === chain)
    .filter(u => type === 'all' || u.type === type)
    .filter(u => u.tvl >= minTvl)
    .sort((a, b) => a.unlockDate.getTime() - b.unlockDate.getTime()),
    [chain, type, minTvl])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])

  const totalTvl = filtered.reduce((s, u) => s + u.tvl, 0)

  return (
    <div className="analytics-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">Unlock Calendar</h1>
        <p className="page-desc">Upcoming lock expirations across all chains — {filtered.length} unlocks totaling {fmtTvl(totalTvl)}</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
          <Filter size={13} color="var(--dim)" />
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Filter:</span>
        </div>

        {/* Chain filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'ETH', 'BNB', 'Base'] as const).map(c => (
            <button key={c} onClick={() => setChain(c)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${chain === c ? 'rgba(217, 173, 74,0.5)' : 'var(--border)'}`,
              background: chain === c ? 'rgba(217, 173, 74,0.12)' : 'transparent',
              color: chain === c ? 'var(--accent)' : 'var(--dim)',
            }}>{c === 'all' ? 'All Chains' : c}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'LP', 'Token'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${type === t ? 'rgba(103, 199, 144,0.5)' : 'var(--border)'}`,
              background: type === t ? 'rgba(103, 199, 144,0.12)' : 'transparent',
              color: type === t ? 'var(--accent-alt)' : 'var(--dim)',
            }}>{t === 'all' ? 'All Types' : t}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Min TVL */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([0, 250000, 500000, 1000000] as const).map(v => (
            <button key={v} onClick={() => setMinTvl(v)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${minTvl === v ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
              background: minTvl === v ? 'rgba(34,197,94,0.08)' : 'transparent',
              color: minTvl === v ? 'var(--success)' : 'var(--dim)',
            }}>{v === 0 ? 'Any TVL' : `$${v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1_000}K`}+`}</button>
          ))}
        </div>

        {/* View toggle — pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--card)', borderRadius: 6, padding: 3, border: '1px solid var(--border)' }}>
          <button onClick={() => setView('list')} style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px',
            borderRadius: 4, cursor: 'pointer',
            background: view === 'list' ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: view === 'list' ? 'var(--text)' : 'var(--dim)',
          }}><List size={12} /> List</button>
          <button onClick={() => setView('calendar')} style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px',
            borderRadius: 4, cursor: 'pointer',
            background: view === 'calendar' ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: view === 'calendar' ? 'var(--text)' : 'var(--dim)',
          }}><Calendar size={12} /> Calendar</button>
        </div>
      </motion.div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
          No unlocks match these filters.
        </div>
      ) : view === 'list' ? (
        <ListView grouped={grouped} navigate={navigate} />
      ) : (
        <CalendarView filtered={filtered} navigate={navigate} />
      )}
    </div>
  )
}

function ListView({ grouped, navigate }: { grouped: Map<string, CalendarUnlock[]>; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
      {[...grouped.entries()].map(([month, items], gi) => (
        <motion.div key={month}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: gi * 0.04 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{month}</span>
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>{items.length} unlock{items.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 11, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtTvl(items.reduce((s, u) => s + u.tvl, 0))} total
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div className="analytics-grid" style={{ gap: 8 }}>
            {items.map(u => {
              const days = daysUntil(u.unlockDate)
              const col = urgencyColor(days)
              return (
                <motion.div
                  key={u.id}
                  className="chart-card"
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                  whileHover={{ y: -1, borderColor: 'rgba(217, 173, 74,0.3)' }}
                  onClick={() => navigate(`/lock/${u.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(217, 173, 74,0.1)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {u.symbol.slice(0, 4)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.asset}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: `${CHAIN_COLOR[u.chain]}18`, color: CHAIN_COLOR[u.chain],
                        }}>{u.chain}</span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                          background: u.type === 'LP' ? 'rgba(103, 199, 144,0.1)' : 'rgba(241, 203, 115,0.1)',
                          color: u.type === 'LP' ? 'var(--accent-alt)' : 'var(--accent-2)',
                        }}>{u.type}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtTvl(u.tvl)}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{u.lockPct}% locked</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
                        <Clock size={10} color="var(--dim)" />
                        <span style={{ fontSize: 11, color: 'var(--dim)' }}>
                          {u.unlockDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                        background: `${col}18`, color: col, border: `1px solid ${col}40`,
                      }}>
                        {days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function CalendarView({ filtered, navigate }: { filtered: CalendarUnlock[]; navigate: ReturnType<typeof useNavigate> }) {
  const months = useMemo(() => {
    const seen = new Set<string>()
    const list: { year: number; month: number; label: string }[] = []
    for (const u of filtered) {
      const y = u.unlockDate.getFullYear(), m = u.unlockDate.getMonth()
      const key = `${y}-${m}`
      if (!seen.has(key)) { seen.add(key); list.push({ year: y, month: m, label: u.unlockDate.toLocaleString('default', { month: 'long', year: 'numeric' }) }) }
    }
    return list
  }, [filtered])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      {months.map(({ year, month, label }, mi) => {
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const firstDow = new Date(year, month, 1).getDay()
        const monthUnlocks = filtered.filter(u => u.unlockDate.getFullYear() === year && u.unlockDate.getMonth() === month)
        const byDay = new Map<number, CalendarUnlock[]>()
        for (const u of monthUnlocks) {
          const d = u.unlockDate.getDate()
          if (!byDay.has(d)) byDay.set(d, [])
          byDay.get(d)!.push(u)
        }

        return (
          <motion.div key={label} className="chart-card"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: mi * 0.05 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 11, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtTvl(monthUnlocks.reduce((s, u) => s + u.tvl, 0))} unlocking
              </span>
            </div>
            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--dim)', padding: '3px 0', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const events = byDay.get(day) || []
                const hasEvent = events.length > 0
                const topTvl = events.reduce((s, u) => s + u.tvl, 0)
                return (
                  <div key={day} style={{
                    minHeight: 44, borderRadius: 5, padding: '4px 5px',
                    background: hasEvent ? 'rgba(217, 173, 74,0.08)' : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${hasEvent ? 'rgba(217, 173, 74,0.25)' : 'var(--border-2)'}`,
                    cursor: hasEvent ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                    onClick={() => hasEvent && navigate(`/lock/${events[0].id}`)}
                  >
                    <div style={{ fontSize: 10, fontWeight: hasEvent ? 700 : 400, color: hasEvent ? 'var(--accent)' : 'var(--dim)', lineHeight: 1 }}>{day}</div>
                    {hasEvent && (
                      <div style={{ marginTop: 3 }}>
                        {events.slice(0, 2).map(u => (
                          <div key={u.id} style={{
                            fontSize: 8.5, fontWeight: 600, color: 'var(--text)',
                            background: `${CHAIN_COLOR[u.chain]}22`, borderRadius: 2, padding: '1px 3px', marginBottom: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{u.symbol}</div>
                        ))}
                        {events.length > 2 && <div style={{ fontSize: 8, color: 'var(--dim)' }}>+{events.length - 2}</div>}
                        {topTvl > 0 && <div style={{ fontSize: 8.5, color: 'var(--success)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtTvl(topTvl)}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
