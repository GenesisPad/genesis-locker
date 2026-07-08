import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, CheckCircle, Shield, Copy, ExternalLink, Infinity, Clock, ChevronLeft, Globe, Twitter, MessageCircle, Hash } from 'lucide-react'
import { motion } from 'framer-motion'
import { RiskBadge } from '../components/RiskBadge'
import { ApiLock, api, formatAmount, formatDate, formatUsd, shortAddress } from '../lib/api'
import { parseMetadataURI } from '../lib/metadata'
import { manageLockTransaction } from '../lib/wallet'

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      style={{ color: copied ? 'var(--success)' : 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
    >
      <Copy size={12} />
    </button>
  )
}

// Matches the severity mapping in RiskBadge's RISK_BADGES legend, so a given
// flag reads the same color everywhere it appears in the app.
const DANGER_WARNINGS = new Set(['Mint Risk', 'High Tax Risk', 'Blacklist Risk', 'Ownership Not Renounced'])
function warningLevel(label: string): 'warning' | 'danger' {
  return DANGER_WARNINGS.has(label) ? 'danger' : 'warning'
}

function pctProgress(lock: ApiLock) {
  if (lock.isPermanent || !lock.unlockDate) return 100
  const start = new Date(lock.startDate).getTime()
  const end = new Date(lock.unlockDate).getTime()
  if (end <= start) return 100
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)))
}

export function LockDetail() {
  const { chainId, id } = useParams()
  const navigate = useNavigate()
  const [lock, setLock] = useState<ApiLock | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [extendDate, setExtendDate] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [newOwner, setNewOwner] = useState('')

  useEffect(() => {
    const finalChainId = Number(chainId || 1)
    const finalLockId = id || '1'
    api.lock(finalChainId, finalLockId)
      .then(response => {
        setLock(response.locks[0] || null)
        setWarnings(response.warnings)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load lock'))
      .finally(() => setLoading(false))
  }, [chainId, id])

  const progress = useMemo(() => lock ? pctProgress(lock) : 0, [lock])
  const metadata = useMemo(() => lock ? parseMetadataURI(lock.metadataURI) : null, [lock])

  async function runAction(action: 'withdraw' | 'permanentLock' | 'extendLock' | 'increaseLockAmount' | 'transferLockOwnership') {
    if (!lock) return
    try {
      setError('')
      let value: string | number | undefined
      if (action === 'extendLock') {
        if (!extendDate) throw new Error('Pick a new unlock date first')
        const parsed = Math.floor(new Date(`${extendDate}T00:00:00`).getTime() / 1000)
        if (!Number.isFinite(parsed)) throw new Error('Invalid date')
        value = parsed
      } else if (action === 'increaseLockAmount') {
        if (!addAmount) throw new Error('Enter an amount to add first')
        value = addAmount
      } else if (action === 'transferLockOwnership') {
        if (!newOwner) throw new Error('Enter the new owner address first')
        value = newOwner
      }

      setPendingAction(action)
      setActionStatus('Submitting transaction...')
      const tokenInfo = action === 'increaseLockAmount' ? { tokenAddress: lock.assetAddress, decimals: lock.token?.decimals ?? 18 } : undefined
      const tx = await manageLockTransaction(lock.contractAddress, action, lock.lockId, value, tokenInfo)
      setActionStatus('Waiting for confirmation...')
      await tx.wait()
      setActionStatus('Transaction confirmed. This page updates within a few minutes.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setActionStatus('')
    } finally {
      setPendingAction(null)
    }
  }

  const minExtendDate = useMemo(() => {
    if (!lock?.unlockDate) return undefined
    const d = new Date(lock.unlockDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [lock])

  if (loading) return <div className="lock-detail-page"><div className="form-alert">Loading lock proof...</div></div>
  if (!lock) return <div className="lock-detail-page"><div className="form-alert error">{error || 'Lock not found'}</div></div>

  return (
    <div className="lock-detail-page">
      <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 12.5, marginBottom: 20, fontWeight: 500 }}>
        <ChevronLeft size={14} /> Back to Explorer
      </button>

      <motion.div className={`verified-banner ${lock.assetType === 'lp' ? 'lp-verified' : 'token-verified'}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <CheckCircle2 size={22} />
        <div>
          <div>{lock.assetType === 'lp' ? 'LP Lock Verified' : 'Token Lock Verified'}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>
            {formatAmount(lock.amount, lock.token?.decimals ?? 18)} {lock.token?.symbol || shortAddress(lock.assetAddress)} · {lock.isPermanent ? 'Permanent' : `Unlocks ${formatDate(lock.unlockDate)}`}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, opacity: 0.95, flexShrink: 0 }}>Lock #{lock.lockId}</span>
      </motion.div>

      {metadata && (metadata.logo || metadata.banner || metadata.description || metadata.website || metadata.twitter || metadata.telegram || metadata.discord) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.03 }}
          className="detail-card"
          style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}
        >
          {metadata.logo && (
            <div style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, border: '2px solid rgba(217, 173, 74,0.3)', overflow: 'hidden', background: '#242018' }}>
              <img src={metadata.logo} alt={metadata.name || lock.token?.symbol || 'Project logo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: metadata.description ? 6 : 0 }}>
              {metadata.name || lock.token?.symbol}
            </div>
            {metadata.description && (
              <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 10px', maxWidth: 640 }}>{metadata.description}</p>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {metadata.website && (
                <a href={metadata.website.startsWith('http') ? metadata.website : `https://${metadata.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dim)', textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <Globe size={10} /> {metadata.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {metadata.twitter && (
                <a href={metadata.twitter.startsWith('http') ? metadata.twitter : `https://x.com/${metadata.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dim)', textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <Twitter size={10} /> X
                </a>
              )}
              {metadata.telegram && (
                <a href={metadata.telegram.startsWith('http') ? metadata.telegram : `https://${metadata.telegram}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dim)', textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <MessageCircle size={10} /> Telegram
                </a>
              )}
              {metadata.discord && (
                <a href={metadata.discord.startsWith('http') ? metadata.discord : `https://${metadata.discord}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dim)', textDecoration: 'none', padding: '3px 9px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <Hash size={10} /> Discord
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <div className="lock-detail-grid">
          <div className="detail-card">
            <div className="detail-card-label">Asset Information</div>
            <div className="detail-field"><span className="detail-field-label">Asset</span><span className="detail-field-val">{lock.token?.symbol || shortAddress(lock.assetAddress)}</span></div>
            <div className="detail-field"><span className="detail-field-label">Asset Address</span><span className="detail-field-val addr">{shortAddress(lock.assetAddress)} <CopyBtn value={lock.assetAddress} /></span></div>
            <div className="detail-field">
              <span className="detail-field-label">Asset Page</span>
              <span className="detail-field-val">
                <button
                  onClick={() => navigate(`/project/${lock.assetAddress}`)}
                  style={{ fontSize: 11.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                >
                  <ExternalLink size={11} />
                  {lock.assetType === 'lp' ? 'View LP Detail' : 'View Token Detail'}
                </button>
              </span>
            </div>
            <div className="detail-field"><span className="detail-field-label">Chain</span><span className="detail-field-val">{lock.chainId}</span></div>
            <div className="detail-field"><span className="detail-field-label">Lock Type</span><span className="detail-field-val">{lock.lockType}</span></div>
            <div className="detail-field"><span className="detail-field-label">Amount Locked</span><span className="detail-field-val">{formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)}</span></div>
            <div className="detail-field"><span className="detail-field-label">USD Value</span><span className="detail-field-val" style={{ color: 'var(--success)' }}>{formatUsd(lock.tvlUsd)}</span></div>
          </div>

          <div className="detail-card">
            <div className="detail-card-label">Lock Status</div>
            <div className="detail-field"><span className="detail-field-label">Status</span><span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>{lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle size={9} /> Active</>}</span></div>
            <div className="detail-field"><span className="detail-field-label">Created</span><span className="detail-field-val">{formatDate(lock.startDate)}</span></div>
            <div className="detail-field"><span className="detail-field-label">Unlock Date</span><span className="detail-field-val">{formatDate(lock.unlockDate)}</span></div>
            <div className="detail-field"><span className="detail-field-label">Claimable</span><span className="detail-field-val">{formatAmount(lock.claimableAmount, lock.token?.decimals ?? 18)}</span></div>
            <div className="progress-section">
              <div className="progress-label"><span>Lock Progress</span><span style={{ fontWeight: 700 }}>{progress}%</span></div>
              <div className="progress-track"><motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} /></div>
              <div className="time-remaining"><Clock size={12} style={{ display: 'inline', marginRight: 5 }} />{lock.isPermanent ? 'Withdrawal rights renounced' : 'Unlock schedule active'}</div>
            </div>
          </div>

          <div className="detail-card detail-card-full">
            <div className="detail-card-label">Addresses</div>
            <div className="detail-address-grid">
              <div className="detail-field"><span className="detail-field-label">Owner</span><span className="detail-field-val addr">{shortAddress(lock.owner)} <CopyBtn value={lock.owner} /></span></div>
              <div className="detail-field"><span className="detail-field-label">Beneficiary</span><span className="detail-field-val addr">{shortAddress(lock.beneficiary)} <CopyBtn value={lock.beneficiary} /></span></div>
              <div className="detail-field"><span className="detail-field-label">Transaction</span><span className="detail-field-val addr">{shortAddress(lock.createdTxHash)} {lock.createdTxHash && <CopyBtn value={lock.createdTxHash} />} {lock.createdTxUrl && <a href={lock.createdTxUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dim)' }}><ExternalLink size={11} /></a>}</span></div>
              <div className="detail-field"><span className="detail-field-label">Permanent Lock</span><span className="detail-field-val">{lock.isPermanent ? <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><Infinity size={13} /> Yes, Withdrawal Renounced</span> : 'No'}</span></div>
            </div>
          </div>
        </div>

        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="detail-card-label">Wallet Actions</div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 14 }}>
            Only the lock owner ({shortAddress(lock.owner)}) can extend, add amount, permanently lock, or transfer. Only the beneficiary ({shortAddress(lock.beneficiary)}) can withdraw claimable tokens.
          </div>
          {(error || actionStatus) && (
            <div className={`form-alert${error ? ' error' : ''}`} style={{ marginBottom: 14 }}>{error || actionStatus}</div>
          )}
          <div className="action-rows">
            <div className="action-row">
              <button className="btn-secondary" disabled={!!pendingAction} onClick={() => runAction('withdraw')}>
                {pendingAction === 'withdraw' ? 'Withdrawing…' : 'Withdraw Claimable'}
              </button>
              <button className="btn-secondary" disabled={!!pendingAction || lock.isPermanent} onClick={() => runAction('permanentLock')}>
                {pendingAction === 'permanentLock' ? 'Locking…' : 'Permanent Lock'}
              </button>
            </div>
            <div className="action-row">
              <span className="action-row-label">Extend to</span>
              <input
                type="date"
                className="action-input"
                style={{ minWidth: 160 }}
                value={extendDate}
                min={minExtendDate}
                onChange={e => setExtendDate(e.target.value)}
                disabled={!!pendingAction || lock.isPermanent}
              />
              <button className="btn-secondary" disabled={!!pendingAction || lock.isPermanent} onClick={() => runAction('extendLock')}>
                {pendingAction === 'extendLock' ? 'Extending…' : 'Extend'}
              </button>
            </div>
            <div className="action-row">
              <span className="action-row-label">Add amount</span>
              <input
                type="number"
                min="0"
                step="any"
                className="action-input"
                style={{ minWidth: 160 }}
                placeholder={`Amount in ${lock.token?.symbol || 'tokens'}`}
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                disabled={!!pendingAction || lock.isPermanent}
              />
              <button className="btn-secondary" disabled={!!pendingAction || lock.isPermanent} onClick={() => runAction('increaseLockAmount')}>
                {pendingAction === 'increaseLockAmount' ? 'Adding…' : 'Add Amount'}
              </button>
            </div>
            <div className="action-row">
              <span className="action-row-label">New owner</span>
              <input
                type="text"
                className="action-input"
                style={{ minWidth: 260, fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                placeholder="0x..."
                value={newOwner}
                onChange={e => setNewOwner(e.target.value)}
                disabled={!!pendingAction}
              />
              <button className="btn-secondary" disabled={!!pendingAction} onClick={() => runAction('transferLockOwnership')}>
                {pendingAction === 'transferLockOwnership' ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>

        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="detail-card-label">Risk Assessment</div>
          <div className="lock-badges-row">
            {lock.badges.map(badge => <RiskBadge key={badge} level="success" label={badge} />)}
            {warnings.map(warning => <RiskBadge key={warning} level={warningLevel(warning)} label={warning} />)}
          </div>
        </div>

        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="detail-card-label">Event History</div>
          {lock.events.length === 0 ? <div className="text-dim">No events indexed yet.</div> : lock.events.map(event => (
            <div className="detail-field" key={`${event.txHash}-${event.logIndex}`}>
              <span className="detail-field-label">{event.eventName}</span>
              <span className="detail-field-val addr">{shortAddress(event.txHash)} {event.txUrl && <a href={event.txUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dim)' }}><ExternalLink size={11} /></a>}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', background: 'rgba(217, 173, 74,0.05)', border: '1px solid rgba(217, 173, 74,0.14)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={18} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Share this lock verification</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>locker.genesispad.app/lock/{lock.chainId}/{lock.lockId}</div>
          </div>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => navigator.clipboard.writeText(`https://locker.genesispad.app/lock/${lock.chainId}/${lock.lockId}`).catch(() => {})}>
            <Copy size={12} /> Copy Link
          </button>
        </div>
      </motion.div>
    </div>
  )
}
