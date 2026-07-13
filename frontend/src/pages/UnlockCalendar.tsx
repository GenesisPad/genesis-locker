import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, List, Clock, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, proofPath, type ApiLock } from '../lib/api'
import { CHAIN_CONFIGS, getChainById } from '../lib/chains'

type CalendarUnlock = {
  chainId: number
  lockId: string
  contractAddress: string
  asset: string
  symbol: string
  type: 'LP' | 'Token'
  tvl: number
  unlockDate: Date
  lockPct: number
}

function toCalendarUnlock(lock: ApiLock): CalendarUnlock | null {
  if (lock.isPermanent || !lock.unlockDate) return null
  const unlockDate = new Date(lock.unlockDate)
  if (unlockDate.getTime() < Date.now()) return null
  const symbol = lock.token?.symbol || `${lock.assetAddress.slice(0, 6)}...`
  return {
    chainId: lock.chainId,
    lockId: lock.lockId,
    contractAddress: lock.contractAddress,
    asset: symbol,
    symbol,
    type: lock.assetType === 'lp' ? 'LP' : 'Token',
    tvl: lock.tvlUsd ? Number(lock.tvlUsd) : 0,
    unlockDate,
    lockPct: lock.lockedPercentage ? Number(lock.lockedPercentage) : 0,
  }
}

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
  const [chain, setChain] = useState<'all' | number>('all')
  const [type, setType] = useState<'all' | 'LP' | 'Token'>('all')
  const [minTvl, setMinTvl] = useState(0)
  const [raw, setRaw] = useState<CalendarUnlock[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.locks(100)
      .then(r => setRaw(r.locks.map(toCalendarUnlock).filter((u): u is CalendarUnlock => u !== null)))
      .catch(() => setRaw([]))
      .finally(() => setLoaded(true))
  }, [])

  const filtered = useMemo(() => raw
    .filter(u => chain === 'all' || u.chainId === chain)
    .filter(u => type === 'all' || u.type === type)
    .filter(u => u.tvl >= minTvl)
    .sort((a, b) => a.unlockDate.getTime() - b.unlockDate.getTime()),
    [raw, chain, type, minTvl])

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
          {(['all', ...CHAIN_CONFIGS.map(c => c.id)] as const).map(c => (
            <button key={c} onClick={() => setChain(c)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${chain === c ? 'rgba(213, 253, 81,0.5)' : 'var(--border)'}`,
              background: chain === c ? 'rgba(213, 253, 81,0.12)' : 'transparent',
              color: chain === c ? 'var(--accent)' : 'var(--dim)',
            }}>{c === 'all' ? 'All Chains' : getChainById(c)?.name ?? c}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'LP', 'Token'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${type === t ? 'rgba(55, 213, 159,0.5)' : 'var(--border)'}`,
              background: type === t ? 'rgba(55, 213, 159,0.12)' : 'transparent',
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
      {!loaded ? (
        <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
          {raw.length === 0 ? 'No upcoming unlocks yet.' : 'No unlocks match these filters.'}
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
                  key={`${u.chainId}-${u.lockId}`}
                  className="chart-card"
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                  whileHover={{ y: -1, borderColor: 'rgba(213, 253, 81,0.3)' }}
                  onClick={() => navigate(proofPath(u))}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(213, 253, 81,0.1)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                    }}>
                      {u.symbol.slice(0, 4)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.asset}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: `${getChainById(u.chainId)?.dotColor ?? '#8c918b'}18`, color: getChainById(u.chainId)?.dotColor ?? '#8c918b',
                        }}>{getChainById(u.chainId)?.name ?? `Chain ${u.chainId}`}</span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                          background: u.type === 'LP' ? 'rgba(55, 213, 159,0.1)' : 'rgba(229, 254, 170,0.1)',
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
                    background: hasEvent ? 'rgba(213, 253, 81,0.08)' : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${hasEvent ? 'rgba(213, 253, 81,0.25)' : 'var(--border-2)'}`,
                    cursor: hasEvent ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                    onClick={() => hasEvent && navigate(proofPath(events[0]))}
                  >
                    <div style={{ fontSize: 10, fontWeight: hasEvent ? 700 : 400, color: hasEvent ? 'var(--accent)' : 'var(--dim)', lineHeight: 1 }}>{day}</div>
                    {hasEvent && (
                      <div style={{ marginTop: 3 }}>
                        {events.slice(0, 2).map(u => (
                          <div key={`${u.chainId}-${u.lockId}`} style={{
                            fontSize: 8.5, fontWeight: 600, color: 'var(--text)',
                            background: `${getChainById(u.chainId)?.dotColor ?? '#8c918b'}22`, borderRadius: 2, padding: '1px 3px', marginBottom: 1,
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
