import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Globe, Twitter, MessageCircle, Hash, ExternalLink,
  Copy, Shield, Lock, Infinity, CheckCircle, BarChart2,
  AlertTriangle, Code2, ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import { MOCK_PROFILES, ProjectProfile } from '../lib/projectProfiles'
import { RiskScorecard, mockRiskData } from '../components/RiskScorecard'
import { getChainByName } from '../lib/chains'

function seedN(addr: string) {
  let h = 5381
  for (let i = 2; i < addr.length; i++) h = ((h << 5) + h + parseInt(addr[i] || '0', 16)) & 0x7fffffff
  return Math.abs(h)
}

function fmt(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function scoreColor(s: number) {
  return s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)'
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      title="Copy"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: ok ? 'var(--success)' : 'var(--dim)' }}
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1800) }}
    >
      <Copy size={11} />
    </button>
  )
}

// ── market data (deterministic mock) ──────────────────────────────────────
function marketData(p: ProjectProfile) {
  const h = seedN(p.address)
  const priceUsd = ((h % 99999) + 1) / (h % 3 === 0 ? 1e6 : 1e4)
  const mcap = p.tvlLocked * 2.4 + (h % 500000)
  const fdv = mcap * (1 + (h % 3) * 0.35)
  const vol24h = mcap * (0.03 + (h % 17) / 100)
  const change24h = ((h % 400) - 180) / 10
  const holders = 800 + (h % 14000)
  const supply = Math.round(mcap / priceUsd).toLocaleString()
  return { priceUsd, mcap, fdv, vol24h, change24h, holders, supply }
}

// ── LP pair data ───────────────────────────────────────────────────────────
function lpData(p: ProjectProfile) {
  const h = seedN(p.lpAddress || p.address)
  const pair1 = p.chain === 'BNB' ? 'BNB' : 'WETH'
  const dex = p.chain === 'BNB' ? 'PancakeSwap V2' : p.chain === 'Base' ? 'Aerodrome' : 'Uniswap V2'
  const tvl = p.tvlLocked * 0.45
  const reserve0 = ((h % 8000) + 500).toLocaleString()
  const reserve1 = ((h % 400) + 50).toFixed(2)
  const price0 = ((h % 200) + 5).toFixed(3)
  const price1 = p.chain === 'BNB' ? '310.00' : '2340.00'
  const vol = tvl * (0.04 + (h % 12) / 100)
  const fees = vol * 0.003
  return { dex, pair1, tvl, reserve0, reserve1, price0, price1, vol, fees, lockedPct: p.lockPct }
}

// ── multiple locks ─────────────────────────────────────────────────────────
interface ProjectLock {
  id: string
  name: string
  type: 'token' | 'lp'
  amount: string
  symbol: string
  usdValue: number
  mode: 'cliff' | 'vesting' | 'permanent'
  unlockDate: string
  daysLeft: number | null
  isPermanent: boolean
  lockPct: number
}

const TOKEN_LOCK_TEMPLATES = [
  { name: 'Team Allocation',    mode: 'cliff',   share: 0.18, baseDays: 365 },
  { name: 'Marketing Fund',     mode: 'vesting', share: 0.10, baseDays: 180 },
  { name: 'Advisor Tokens',     mode: 'cliff',   share: 0.06, baseDays: 270 },
  { name: 'Development Fund',   mode: 'vesting', share: 0.14, baseDays: 730 },
  { name: 'Treasury Reserve',   mode: 'cliff',   share: 0.09, baseDays: 547 },
  { name: 'Ecosystem Fund',     mode: 'vesting', share: 0.08, baseDays: 450 },
  { name: 'Seed Round',         mode: 'cliff',   share: 0.05, baseDays: 180 },
  { name: 'Strategic Partners', mode: 'vesting', share: 0.06, baseDays: 365 },
] as const

function buildLocks(profile: ProjectProfile): ProjectLock[] {
  const h = seedN(profile.address)
  const pair1 = profile.chain === 'BNB' ? 'BNB' : 'WETH'

  // How many token locks this project has (based on trust score)
  const numToken = profile.trustScore >= 85 ? 4 : profile.trustScore >= 65 ? 3 : 2

  const locks: ProjectLock[] = []

  for (let i = 0; i < numToken; i++) {
    const tpl = TOKEN_LOCK_TEMPLATES[(h + i * 3) % TOKEN_LOCK_TEMPLATES.length]
    const days = tpl.baseDays + ((h >> (i * 3)) % 120)
    const usd = profile.tvlLocked * tpl.share
    const tokenAmt = (usd / (0.00015 + ((h % 100) / 1e6))).toLocaleString(undefined, { maximumFractionDigits: 0 })
    locks.push({
      id: `t${i}`,
      name: tpl.name,
      type: 'token',
      amount: tokenAmt,
      symbol: profile.symbol,
      usdValue: usd,
      mode: tpl.mode as 'cliff' | 'vesting',
      unlockDate: new Date(Date.now() + days * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      daysLeft: days,
      isPermanent: false,
      lockPct: Math.round(profile.lockPct * tpl.share * 4),
    })
  }

  // LP lock
  if (profile.lpAddress) {
    const lpDays = profile.isPermanent ? null : 730 + ((h >> 8) % 365)
    locks.push({
      id: 'lp0',
      name: `${profile.symbol}/${pair1} Liquidity Lock`,
      type: 'lp',
      amount: (100 + (h % 900)).toFixed(4),
      symbol: `${profile.symbol}/${pair1} LP`,
      usdValue: profile.tvlLocked * 0.4,
      mode: profile.isPermanent ? 'permanent' : 'cliff',
      unlockDate: profile.isPermanent ? 'Never' : new Date(Date.now() + (lpDays || 0) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      daysLeft: lpDays,
      isPermanent: profile.isPermanent,
      lockPct: Math.round(profile.lockPct * 0.9),
    })

    // Second LP lock for high-trust projects
    if (profile.trustScore >= 82) {
      locks.push({
        id: 'lp1',
        name: `${profile.symbol}/${pair1} Staking Reserve`,
        type: 'lp',
        amount: ((h % 40) + 10).toFixed(4),
        symbol: `${profile.symbol}/${pair1} LP`,
        usdValue: profile.tvlLocked * 0.08,
        mode: 'vesting',
        unlockDate: new Date(Date.now() + 365 * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        daysLeft: 365,
        isPermanent: false,
        lockPct: Math.round(profile.lockPct * 0.08),
      })
    }
  }

  // Sort: LP locks first, then token by USD desc
  return locks.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'lp' ? -1 : 1
    return b.usdValue - a.usdValue
  })
}

// ── lock events timeline ───────────────────────────────────────────────────
function buildEvents(profile: ProjectProfile) {
  const h = seedN(profile.address)
  const now = Date.now()
  const events = [
    { icon: '🔒', label: 'LockCreated', detail: `Liquidity locked via Genesis Locker`, time: new Date(now - (380 + h % 200) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { icon: '🔒', label: 'LockCreated', detail: `Team tokens locked (${TOKEN_LOCK_TEMPLATES[h % 8].name})`, time: new Date(now - (300 + h % 100) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  ]
  if (profile.trustScore >= 70) {
    events.push({ icon: '📅', label: 'LockExtended', detail: 'Lock duration extended by 180 days', time: new Date(now - (120 + h % 80) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })
  }
  if (profile.isPermanent) {
    events.push({ icon: '♾️', label: 'PermanentLock', detail: 'Liquidity permanently locked, withdrawal rights renounced', time: new Date(now - (60 + h % 60) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })
  }
  if (profile.isRenounced) {
    events.push({ icon: '🛡️', label: 'OwnershipRenounced', detail: 'Contract ownership renounced on-chain', time: new Date(now - (30 + h % 30) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })
  }
  return events.reverse()
}

// ── component ──────────────────────────────────────────────────────────────
export function ProjectDetail() {
  const { address } = useParams<{ address: string }>()
  const navigate = useNavigate()
  const [showEmbed, setShowEmbed] = useState(false)
  const [apiExpanded, setApiExpanded] = useState(false)

  const profile = useMemo(
    () => MOCK_PROFILES.find(p => p.address.toLowerCase() === (address || '').toLowerCase()),
    [address]
  )

  if (!profile) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--dim)' }}>
        <Shield size={40} style={{ marginBottom: 16, opacity: 0.25 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Project not found</div>
        <div style={{ fontSize: 13, marginBottom: 24 }}>No verified profile is associated with this address.</div>
        <button onClick={() => navigate('/projects')} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(217, 173, 74,0.15)', border: '1px solid rgba(217, 173, 74,0.3)', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to Projects
        </button>
      </div>
    )
  }

  const market = marketData(profile)
  const lp = profile.lpAddress ? lpData(profile) : null
  const locks = buildLocks(profile)
  const events = buildEvents(profile)
  const risk = mockRiskData(profile.address)
  const totalLocked = locks.reduce((s, l) => s + l.usdValue, 0)
  const sc = scoreColor(profile.trustScore)
  const chainCfg = getChainByName(profile.chain)
  const explorer = (chainCfg?.explorerUrl ?? 'https://etherscan.io') + '/address/'
  const geckoChain = chainCfg?.geckoTerminalId ?? 'eth'
  const geckoPool = profile.lpAddress || profile.address
  const geckoUrl = `https://www.geckoterminal.com/${geckoChain}/pools/${geckoPool}?embed=1&info=0&swaps=0&theme=dark`

  const embedSnippet = `<iframe\n  src="https://locker.genesispad.app/badge/${profile.address}"\n  width="280" height="72"\n  frameborder="0"\n  style="border:none"\n/>`

  return (
    <div className="explorer-page">

      {/* Back */}
      <button
        onClick={() => navigate('/projects')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dim)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 14px', marginBottom: 0 }}
      >
        <ArrowLeft size={13} /> Back to Verified Projects
      </button>

      {/* Banner */}
      {profile.banner ? (
        <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--border)' }}>
          <img src={profile.banner} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
      ) : (
        <div style={{ height: 120, borderRadius: 12, marginBottom: 20, background: 'linear-gradient(135deg, #10110f 0%, #242018 55%, #10110f 100%)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, var(--accent) 0, var(--accent) 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }} />
        </div>
      )}

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 14, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        {/* Logo */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, border: '3px solid rgba(217, 173, 74,0.3)', background: '#242018', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#f1cb73', overflow: 'hidden' }}>
          {profile.logo ? <img src={profile.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : profile.symbol.slice(0, 2)}
        </div>

        {/* Name + socials */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{profile.name}</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>{profile.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{profile.chain}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(217, 173, 74,0.12)', color: 'var(--accent)', border: '1px solid rgba(217, 173, 74,0.25)' }}>{profile.category}</span>
          </div>
          {profile.description && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6, maxWidth: 620 }}>{profile.description}</p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profile.website && (
              <a href={`https://${profile.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Globe size={11} /> {profile.website}
              </a>
            )}
            {profile.twitter && (
              <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Twitter size={11} /> X
              </a>
            )}
            {profile.telegram && (
              <a href={profile.telegram.startsWith('http') ? profile.telegram : `https://${profile.telegram}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <MessageCircle size={11} /> Telegram
              </a>
            )}
            {profile.discord && (
              <a href={profile.discord.startsWith('http') ? profile.discord : `https://${profile.discord}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Hash size={11} /> Discord
              </a>
            )}
            <a href={`${explorer}${profile.address}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <ExternalLink size={10} /> Explorer
            </a>
          </div>
        </div>

        {/* Trust score badge */}
        <div style={{ textAlign: 'center', padding: '14px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${sc}40`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Trust Score</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: sc, lineHeight: 1 }}>{profile.trustScore}</div>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>/100</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {profile.isPermanent && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>Permanent</span>}
            {profile.isRenounced && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>Renounced</span>}
            {profile.isAudited && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(103, 199, 144,0.12)', color: '#8fd6ac', border: '1px solid rgba(103, 199, 144,0.3)' }}>Audited</span>}
          </div>
        </div>
      </motion.div>

      {/* Market metrics */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}
      >
        {[
          { label: 'Price', value: market.priceUsd < 0.001 ? `$${market.priceUsd.toExponential(3)}` : `$${market.priceUsd.toFixed(6)}` },
          { label: '24h Change', value: `${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)}%`, color: market.change24h >= 0 ? 'var(--success)' : 'var(--danger)' },
          { label: 'Market Cap', value: fmt(market.mcap), sub: `FDV ${fmt(market.fdv)}` },
          { label: '24h Volume', value: fmt(market.vol24h) },
          { label: 'TVL Locked', value: fmt(totalLocked), sub: `${profile.lockPct}% of supply` },
          { label: 'Holders', value: market.holders.toLocaleString() },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: (m as any).color || 'var(--text)' }}>{m.value}</div>
            {(m as any).sub && <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>{(m as any).sub}</div>}
          </div>
        ))}
      </motion.div>

      {/* 2-col main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>

        {/* ── LEFT column ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >

          {/* Chart */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Price Chart</span>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>powered by GeckoTerminal</span>
              <a href={`https://www.geckoterminal.com/${geckoChain}/pools/${geckoPool}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                Full chart <ExternalLink size={10} />
              </a>
            </div>
            <iframe src={geckoUrl} title="Price Chart" frameBorder="0" style={{ width: '100%', height: 400, display: 'block' }} allow="clipboard-write" />
          </div>

          {/* All Locks */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>All Locks</span>
              <span style={{ fontSize: 11, color: 'var(--dim)', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 10 }}>{locks.length}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dim)' }}>
                Total: <strong style={{ color: 'var(--text)' }}>{fmt(totalLocked)}</strong>
              </span>
            </div>
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Lock Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>USD Value</th>
                    <th>Lock %</th>
                    <th>Mode</th>
                    <th>Unlock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locks.map(lock => (
                    <tr key={lock.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{lock.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'monospace' }}>{lock.symbol}</div>
                      </td>
                      <td>
                        <span className={`type-badge ${lock.type}`}>{lock.type === 'lp' ? 'LP Lock' : 'Token'}</span>
                      </td>
                      <td>
                        <div className="amt-main">{lock.amount}</div>
                      </td>
                      <td>
                        <div className="amt-main">{fmt(lock.usdValue)}</div>
                      </td>
                      <td>
                        <div className="pct-wrap">
                          <div className="pct-bar">
                            <div className={`pct-fill ${lock.lockPct >= 75 ? 'high' : lock.lockPct >= 50 ? 'medium' : 'low'}`} style={{ width: `${Math.min(lock.lockPct, 100)}%` }} />
                          </div>
                          <span className="pct-val">{lock.lockPct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="mode-label">{lock.mode}</span>
                      </td>
                      <td>
                        <div className="date-main" style={{ color: lock.isPermanent ? 'var(--success)' : lock.daysLeft !== null && lock.daysLeft <= 30 ? 'var(--danger)' : undefined, whiteSpace: 'nowrap' }}>
                          {lock.unlockDate}
                        </div>
                        {lock.daysLeft !== null && !lock.isPermanent && (
                          <div className="days-left">{lock.daysLeft}d left</div>
                        )}
                      </td>
                      <td>
                        <span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>
                          {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle size={9} /> Active</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Token + LP technical details */}
          <div style={{ display: 'grid', gridTemplateColumns: lp ? '1fr 1fr' : '1fr', gap: 14 }}>

            {/* Token contract */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Shield size={13} color="var(--accent)" /> Token Contract
              </div>
              {[
                { label: 'Address', value: `${profile.address.slice(0, 10)}...${profile.address.slice(-8)}`, copy: profile.address, mono: true },
                { label: 'Chain', value: profile.chain },
                { label: 'Total Supply', value: `${market.supply} ${profile.symbol}` },
                { label: 'Decimals', value: '18' },
                { label: 'Ownership', value: profile.isRenounced ? 'Renounced' : 'Not Renounced', color: profile.isRenounced ? 'var(--success)' : 'var(--danger)' },
                { label: 'Mint Function', value: profile.noMint ? 'Disabled' : 'Active', color: profile.noMint ? 'var(--success)' : 'var(--warning)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>{row.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: (row as any).color || 'var(--text)', fontFamily: (row as any).mono ? 'monospace' : undefined }}>
                    {row.value}
                    {(row as any).copy && <CopyBtn value={(row as any).copy} />}
                  </span>
                </div>
              ))}
            </div>

            {/* LP pair */}
            {lp && profile.lpAddress && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Layers size={13} color="var(--accent)" /> LP Pair
                </div>
                {[
                  { label: 'Address', value: `${profile.lpAddress.slice(0, 10)}...${profile.lpAddress.slice(-8)}`, copy: profile.lpAddress, mono: true },
                  { label: 'DEX', value: lp.dex },
                  { label: `Reserve (${profile.symbol})`, value: lp.reserve0 },
                  { label: `Reserve (${lp.pair1})`, value: lp.reserve1 },
                  { label: '24h Volume', value: fmt(lp.vol) },
                  { label: '24h Fees', value: fmt(lp.fees) },
                  { label: 'LP Locked', value: `${lp.lockedPct}%`, color: lp.lockedPct >= 70 ? 'var(--success)' : 'var(--warning)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{row.label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: (row as any).color || 'var(--text)', fontFamily: (row as any).mono ? 'monospace' : undefined }}>
                      {row.value}
                      {(row as any).copy && <CopyBtn value={(row as any).copy} />}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lock events timeline */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle size={13} color="var(--accent)" /> Lock History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < events.length - 1 ? 16 : 0, position: 'relative' }}>
                  {i < events.length - 1 && (
                    <div style={{ position: 'absolute', left: 15, top: 28, bottom: 0, width: 1, background: 'var(--border)' }} />
                  )}
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(217, 173, 74,0.12)', border: '1px solid rgba(217, 173, 74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, zIndex: 1 }}>
                    {ev.icon}
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{ev.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ev.detail}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{ev.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── RIGHT column ── */}
        <motion.div
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.12 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Risk scorecard */}
          <RiskScorecard {...risk} />

          {/* Embed badge */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <button
              onClick={() => setShowEmbed(x => !x)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Code2 size={13} color="var(--accent)" /> Embed Lock Badge
              </div>
              {showEmbed ? <ChevronUp size={14} color="var(--dim)" /> : <ChevronDown size={14} color="var(--dim)" />}
            </button>
            {showEmbed && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <iframe src={`/badge/${profile.address}`} width="280" height="72" frameBorder="0" title="Lock Badge" style={{ border: 'none', borderRadius: 8, display: 'block' }} />
                </div>
                <div style={{ position: 'relative' }}>
                  <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 10, color: 'var(--muted)', margin: 0, overflowX: 'auto', lineHeight: 1.6 }}>
                    {embedSnippet}
                  </pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(embedSnippet).catch(() => {})}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(217, 173, 74,0.15)', border: '1px solid rgba(217, 173, 74,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: 10, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* API endpoints */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <button
              onClick={() => setApiExpanded(x => !x)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Code2 size={13} color="var(--accent)" /> API Endpoints
              </div>
              {apiExpanded ? <ChevronUp size={14} color="var(--dim)" /> : <ChevronDown size={14} color="var(--dim)" />}
            </button>
            {apiExpanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { method: 'GET', path: `/v1/tokens/${profile.chain.toLowerCase()}/${profile.address}/locks` },
                  { method: 'GET', path: `/v1/check/${profile.chain.toLowerCase()}/${profile.address}` },
                  ...(profile.lpAddress ? [{ method: 'GET', path: `/v1/lp/${profile.chain.toLowerCase()}/${profile.lpAddress}/status` }] : []),
                ].map(ep => (
                  <div key={ep.path} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginRight: 6 }}>{ep.method}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)', wordBreak: 'break-all' }}>{ep.path}</span>
                  </div>
                ))}
                <a href="/api" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  View full API docs <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Risk notice */}
          {profile.trustScore < 60 && (
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10 }}>
              <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                This project has a low Trust Score. Lock percentage and verification status indicate elevated risk. Always do your own research before investing.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
