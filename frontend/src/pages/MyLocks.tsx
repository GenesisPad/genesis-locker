import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { CheckCircle2, Clock, Coins, Infinity, Wallet } from 'lucide-react'
import { api, formatAmount, formatDate, lockAssetLabel, proofPath, shortAddress, type ApiLock } from '../lib/api'
import { CHAIN_CONFIGS } from '../lib/chains'

function roleFor(lock: ApiLock, address?: string) {
  const user = address?.toLowerCase()
  if (!user) return 'Connect wallet'
  const roles = []
  if (lock.owner.toLowerCase() === user) roles.push(lock.assetType === 'v3_position' ? 'Genesis launch creator' : 'Depositor')
  if (lock.beneficiary.toLowerCase() === user) roles.push('Beneficiary')
  return roles.join(', ') || 'Related lock'
}

function actionFor(lock: ApiLock) {
  if (lock.isPermanent) return 'Permanent lock with no withdrawal action'
  if (lock.lockType === 'vesting') return BigInt(lock.claimableAmount || '0') > 0n ? 'Claim available tokens' : 'Await next release'
  if (lock.unlockDate && new Date(lock.unlockDate).getTime() <= Date.now()) return lock.assetType === 'v3_position' ? 'Position remains permanently locked' : 'Withdraw expired timed lock'
  return 'Await unlock'
}

export function MyLocks() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [chainId, setChainId] = useState(CHAIN_CONFIGS[0].id)
  const [locks, setLocks] = useState<ApiLock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!address) {
      setLocks([])
      return
    }
    setLoading(true)
    setError('')
    api.myLocks(chainId, address)
      .then(response => setLocks(response.locks))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load wallet locks'))
      .finally(() => setLoading(false))
  }, [address, chainId])

  const grouped = useMemo(() => ({
    actionable: locks.filter(lock => !actionFor(lock).startsWith('Await') && !lock.isPermanent),
    permanent: locks.filter(lock => lock.isPermanent),
    waiting: locks.filter(lock => actionFor(lock).startsWith('Await')),
  }), [locks])

  return (
    <div className="my-locks-page">
      <div className="page-heading">
        <h1 className="page-title">My Locks</h1>
        <p className="page-desc">Locks connected to your wallet as depositor, beneficiary or Genesis launch creator.</p>
      </div>

      <div className="explorer-toolbar">
        <div className="filter-row">
          {CHAIN_CONFIGS.map(chain => (
            <button key={chain.id} type="button" className={`filter-chip${chainId === chain.id ? ' active' : ''}`} onClick={() => setChainId(chain.id)}>
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      {!isConnected && (
        <div className="empty-state">
          <Wallet size={20} />
          Connect a wallet to see locks tied to that address.
        </div>
      )}
      {error && <div className="form-alert error">{error}</div>}
      {loading && <div className="form-alert">Loading wallet locks...</div>}

      {isConnected && !loading && locks.length === 0 && <div className="empty-state">No indexed locks found for {shortAddress(address)} on this chain.</div>}

      {(['actionable', 'waiting', 'permanent'] as const).map(group => grouped[group].length > 0 && (
        <section className="my-lock-section" key={group}>
          <div className="section-header">
            <span className="section-title">{group === 'actionable' ? 'Available Actions' : group === 'waiting' ? 'Awaiting Unlock' : 'Permanent Locks'}</span>
          </div>
          <div className="lock-result-list">
            {grouped[group].map(lock => (
              <button className="lock-result-row" key={`${lock.chainId}-${lock.contractAddress}-${lock.lockId}`} onClick={() => navigate(proofPath(lock))}>
                <div className="lock-result-icon">{lock.isPermanent ? <Infinity size={17} /> : lock.lockType === 'vesting' ? <Coins size={17} /> : <Clock size={17} />}</div>
                <div className="lock-result-main">
                  <div className="lock-result-title">{lockAssetLabel(lock)}</div>
                  <div className="lock-result-meta">{roleFor(lock, address)} · {lock.assetType === 'v3_position' ? `Position #${lock.positionTokenId}` : formatAmount(lock.remainingLockedAmount, lock.token?.decimals ?? 18)}</div>
                </div>
                <div className="lock-result-stat">
                  <span>{actionFor(lock)}</span>
                  <small>{lock.isPermanent ? 'Withdrawal does not exist' : formatDate(lock.unlockDate)}</small>
                </div>
                <span className={`status-chip ${lock.isPermanent ? 'permanent' : 'active'}`}>
                  {lock.isPermanent ? <><Infinity size={9} /> Permanent</> : <><CheckCircle2 size={9} /> Active</>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
