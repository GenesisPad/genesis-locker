import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Globe, Twitter, MessageCircle, Hash, ExternalLink,
  Copy, Shield, Lock, Infinity, CheckCircle, BarChart2,
  AlertTriangle, Layers, XCircle,
} from 'lucide-react'
import { ApiLock, GenesisProjectMetadata, api, formatAmount, formatDate, formatUsd, proofPath } from '../lib/api'
import { getChainById } from '../lib/chains'
import { parseMetadataURI } from '../lib/metadata'
import { RiskScorecard, RiskCheck } from '../components/RiskScorecard'

function fmt(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function pctClass(p: number) { return p >= 75 ? 'high' : p >= 50 ? 'medium' : 'low' }

function lockKindLabel(lock: ApiLock) {
  if (lock.assetType === 'v3_position') return 'Liquidity Position'
  return lock.assetType === 'lp' ? 'LP Lock' : 'Token'
}

function lockAmountLabel(lock: ApiLock) {
  if (lock.assetType === 'v3_position') return '1 locked position'
  return formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)
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

// ── real risk scorecard, derived only from on-chain token flags ───────────
function buildRisk(locks: ApiLock[]): { score: number; level: 'Low' | 'Medium' | 'High'; checks: RiskCheck[] } | null {
  const withToken = locks.find(l => l.token)
  if (!withToken?.token) return null
  const t = withToken.token
  const checks: RiskCheck[] = [
    { label: 'Mint Function', status: t.hasMintRisk ? 'fail' : 'pass', value: t.hasMintRisk ? 'Active' : 'Disabled' },
    { label: 'Buy/Sell Tax', status: t.hasHighTaxRisk ? 'warn' : 'pass', value: t.hasHighTaxRisk ? 'High' : 'Normal' },
    { label: 'Blacklist Function', status: t.hasBlacklistRisk ? 'fail' : 'pass', value: t.hasBlacklistRisk ? 'Detected' : 'None detected' },
  ]
  const riskCount = [t.hasMintRisk, t.hasHighTaxRisk, t.hasBlacklistRisk].filter(Boolean).length
  const score = riskCount === 0 ? 15 : riskCount === 1 ? 50 : 85
  const level: 'Low' | 'Medium' | 'High' = riskCount === 0 ? 'Low' : riskCount === 1 ? 'Medium' : 'High'
  return { score, level, checks }
}

// ── component ──────────────────────────────────────────────────────────────
export function ProjectDetail() {
  const { address } = useParams<{ address: string }>()
  const navigate = useNavigate()

  const [allLocks, setAllLocks] = useState<ApiLock[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [projectMeta, setProjectMeta] = useState<GenesisProjectMetadata | null>(null)

  useEffect(() => {
    let active = true
    const load = (showLoading = false) => {
      if (showLoading) setLoading(true)
      api.locks(200)
        .then(r => {
          if (!active) return
          setAllLocks(r.locks)
          setLoadError('')
        })
        .catch(e => active && setLoadError(e instanceof Error ? e.message : 'Failed to load'))
        .finally(() => active && setLoading(false))
    }
    load(true)
    const interval = window.setInterval(() => load(false), 15_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const locks = useMemo(
    () => allLocks.filter(l => l.assetAddress.toLowerCase() === (address || '').toLowerCase()),
    [allLocks, address]
  )

  useEffect(() => {
    if (!address) return
    api.genesisProject(address).then(setProjectMeta).catch(() => setProjectMeta(null))
  }, [address])

  const metadata = useMemo(() => {
    for (const lock of locks) {
      const parsed = parseMetadataURI(lock.metadataURI)
      if (parsed) return parsed
    }
    return null
  }, [locks])
  const mergedMeta = useMemo(() => ({ ...(projectMeta || {}), ...(metadata || {}) }), [metadata, projectMeta])

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--dim)' }}>Loading…</div>
  }

  if (loadError) {
    return <div className="form-alert error" style={{ margin: 24 }}>{loadError}</div>
  }

  if (locks.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--dim)' }}>
        <Shield size={40} style={{ marginBottom: 16, opacity: 0.25 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No locks found</div>
        <div style={{ fontSize: 13, marginBottom: 24 }}>No lock on Genesis Locker is associated with this address.</div>
        <button onClick={() => navigate('/projects')} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(213, 253, 81,0.15)', border: '1px solid rgba(213, 253, 81,0.3)', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to Projects
        </button>
      </div>
    )
  }

  const first = locks[0]
  const chainCfg = getChainById(first.chainId)
  const explorer = (chainCfg?.explorerUrl ?? 'https://etherscan.io') + '/address/'
  const geckoChain = chainCfg?.geckoTerminalId
  const chartAddress = first.poolAddress || first.assetAddress
  const geckoUrl = geckoChain ? `https://www.geckoterminal.com/${geckoChain}/pools/${chartAddress}?embed=1&info=0&swaps=0&theme=dark` : null

  const symbol = mergedMeta.symbol || first.token?.symbol || `${first.assetAddress.slice(0, 6)}...${first.assetAddress.slice(-4)}`
  const name = mergedMeta.name || first.token?.name || symbol
  const totalTvl = locks.reduce((s, l) => s + Number(l.tvlUsd || 0), 0)
  const totalLockedPct = Math.min(100, locks.reduce((s, l) => s + Number(l.lockedPercentage || 0), 0))
  const isPermanent = locks.some(l => l.isPermanent)
  const risk = buildRisk(locks)

  return (
    <div className="explorer-page">

      {/* Back */}
      <button
        onClick={() => navigate('/projects')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dim)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 14px', marginBottom: 0 }}
      >
        <ArrowLeft size={13} /> Back to Projects
      </button>

      {/* Banner */}
      {mergedMeta?.banner ? (
        <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 20, border: '1px solid var(--border)' }}>
          <img src={mergedMeta.banner} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
      ) : (
        <div style={{ height: 120, borderRadius: 12, marginBottom: 20, background: 'linear-gradient(135deg, #10110f 0%, #141a10 55%, #10110f 100%)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, var(--accent) 0, var(--accent) 1px, transparent 0, transparent 50%)', backgroundSize: '14px 14px' }} />
        </div>
      )}

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 14, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        {/* Logo */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, border: '3px solid rgba(213, 253, 81,0.3)', background: '#141a10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#e5feaa', overflow: 'hidden' }}>
          {mergedMeta?.logo ? <img src={mergedMeta.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : symbol.slice(0, 2)}
        </div>

        {/* Name + socials */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{name}</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>{symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{chainCfg?.name || first.chainId}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{lockKindLabel(first)}</span>
          </div>
          {mergedMeta?.description && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6, maxWidth: 620 }}>{mergedMeta.description}</p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {mergedMeta?.website && (
              <a href={mergedMeta.website.startsWith('http') ? mergedMeta.website : `https://${mergedMeta.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Globe size={11} /> {mergedMeta.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {mergedMeta?.twitter && (
              <a href={mergedMeta.twitter.startsWith('http') ? mergedMeta.twitter : `https://x.com/${mergedMeta.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Twitter size={11} /> X
              </a>
            )}
            {mergedMeta?.telegram && (
              <a href={mergedMeta.telegram.startsWith('http') ? mergedMeta.telegram : `https://${mergedMeta.telegram}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <MessageCircle size={11} /> Telegram
              </a>
            )}
            {mergedMeta?.discord && (
              <a href={mergedMeta.discord.startsWith('http') ? mergedMeta.discord : `https://${mergedMeta.discord}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                <Hash size={11} /> Discord
              </a>
            )}
            <a href={`${explorer}${first.assetAddress}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--dim)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <ExternalLink size={10} /> Explorer
            </a>
          </div>
        </div>

        {/* Lock % badge */}
        <div style={{ textAlign: 'center', padding: '14px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            {first.assetType === 'v3_position' ? 'Locked positions' : 'Locked'}
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
            {first.assetType === 'v3_position' ? locks.filter(l => l.assetType === 'v3_position').length : totalLockedPct.toFixed(0)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
            {first.assetType === 'v3_position' ? 'permanent' : '% of supply'}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {isPermanent && <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>Permanent</span>}
          </div>
        </div>
      </motion.div>

      {/* Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}
      >
        {[
          { label: 'TVL Locked', value: fmt(totalTvl) },
          { label: 'Active Locks', value: String(locks.length) },
          { label: first.assetType === 'v3_position' ? 'Position Locks' : 'Locked Supply', value: first.assetType === 'v3_position' ? String(locks.filter(l => l.assetType === 'v3_position').length) : `${totalLockedPct.toFixed(0)}%` },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{m.value}</div>
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
          {geckoUrl && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={13} color="var(--accent)" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Price Chart</span>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>powered by GeckoTerminal</span>
                <a href={`https://www.geckoterminal.com/${geckoChain}/pools/${chartAddress}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  Full chart <ExternalLink size={10} />
                </a>
              </div>
              <iframe src={geckoUrl} title="Price Chart" frameBorder="0" style={{ width: '100%', height: 400, display: 'block' }} allow="clipboard-write" />
            </div>
          )}

          {/* All Locks */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>All Locks</span>
              <span style={{ fontSize: 11, color: 'var(--dim)', background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 10 }}>{locks.length}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dim)' }}>
                Total: <strong style={{ color: 'var(--text)' }}>{fmt(totalTvl)}</strong>
              </span>
            </div>
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>USD Value</th>
                    <th>Lock %</th>
                    <th>Mode</th>
                    <th>Unlock</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {locks.map(lock => {
                    const pct = Number(lock.lockedPercentage || 0)
                    return (
                      <tr key={`${lock.chainId}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))} style={{ cursor: 'pointer' }}>
                        <td>
                          <span className={`type-badge ${lock.assetType}`}>{lockKindLabel(lock)}</span>
                        </td>
                        <td>
                          <div className="amt-main">{lockAmountLabel(lock)}</div>
                        </td>
                        <td>
                          <div className="amt-main">{formatUsd(lock.tvlUsd)}</div>
                        </td>
                        <td>
                          <div className="pct-wrap">
                            <div className="pct-bar">
                              <div className={`pct-fill ${pctClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="pct-val">{lock.assetType === 'v3_position' ? 'Position' : `${pct.toFixed(0)}%`}</span>
                          </div>
                        </td>
                        <td>
                          <span className="mode-label">{lock.lockType}</span>
                        </td>
                        <td>
                          <div className="date-main" style={{ whiteSpace: 'nowrap' }}>{formatDate(lock.unlockDate)}</div>
                        </td>
                        <td>
                          <span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>
                            {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle size={9} /> Active</>}
                          </span>
                        </td>
                        <td><ExternalLink size={12} color="var(--dim)" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Token contract details */}
          {first.token && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Shield size={13} color="var(--accent)" /> Token Contract
              </div>
              {[
                { label: 'Address', value: `${first.assetAddress.slice(0, 10)}...${first.assetAddress.slice(-8)}`, copy: first.assetAddress, mono: true },
                { label: 'Chain', value: chainCfg?.name || first.chainId },
                ...(first.token.totalSupply ? [{ label: 'Total Supply', value: `${formatAmount(first.token.totalSupply, first.token.decimals ?? 18)} ${first.token.symbol || ''}` }] : []),
                { label: 'Decimals', value: String(first.token.decimals ?? 18) },
                { label: 'Mint Function', value: first.token.hasMintRisk ? 'Active' : 'Disabled', color: first.token.hasMintRisk ? 'var(--warning)' : 'var(--success)' },
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

          {first.assetType === 'lp' && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Layers size={13} color="var(--accent)" /> LP Pair
              </div>
              {[
                { label: 'Pair Address', value: `${first.assetAddress.slice(0, 10)}...${first.assetAddress.slice(-8)}`, copy: first.assetAddress, mono: true },
                { label: 'Chain', value: chainCfg?.name || first.chainId },
                { label: 'TVL Locked', value: fmt(totalTvl) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>{row.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: (row as any).mono ? 'monospace' : undefined }}>
                    {row.value}
                    {(row as any).copy && <CopyBtn value={(row as any).copy} />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── RIGHT column ── */}
        <motion.div
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.12 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Risk scorecard, built from real token flags only */}
          {risk ? (
            <RiskScorecard {...risk} />
          ) : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', display: 'flex', gap: 10 }}>
              <XCircle size={16} color="var(--dim)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                No token risk data available for this asset yet.
              </div>
            </div>
          )}

          {locks.length > 0 && !locks[0].token && locks[0].assetType === 'token' && (
            <div style={{ background: 'rgba(225,183,92,0.07)', border: '1px solid rgba(225,183,92,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10 }}>
              <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Token metadata for this asset hasn't been indexed yet. Always verify the contract independently before trusting locked amounts.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
