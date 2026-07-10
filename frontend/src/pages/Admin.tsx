import React, { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatEther, isAddress, parseEther, type Address } from 'viem'
import { ShieldAlert, RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { lockerAdminAbi } from '../lib/lockerAdminAbi'
import { CHAIN_CONFIGS, getChainById } from '../lib/chains'
import { api } from '../lib/api'

const ZERO = '0x0000000000000000000000000000000000000000'

function short(a?: string) {
  if (!a) return '—'
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

/**
 * Admin panel — read the live contract configuration and, for the owner wallet,
 * call the owner-only setters. Every write is executed by the connected wallet,
 * so a non-owner simply cannot succeed (the contract reverts). The UI also
 * hides/greys write actions when the connected wallet is not the owner.
 */
export function Admin() {
  const { address, isConnected } = useAccount()
  const walletChainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [chainId, setChainId] = useState<number>(CHAIN_CONFIGS[0].id)
  const [contractAddress, setContractAddress] = useState<string>('')
  const chain = getChainById(chainId) ?? CHAIN_CONFIGS[0]

  // Auto-fill the locker address from the API for the selected chain (editable).
  useEffect(() => {
    let cancelled = false
    api.chains()
      .then(chains => {
        const match = chains.find(c => c.id === chainId)
        const addr = match?.contracts?.[0]?.address
        if (!cancelled && addr) setContractAddress(addr)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [chainId])

  const validContract = isAddress(contractAddress)
  const contract = validContract ? { address: contractAddress as Address, abi: lockerAdminAbi, chainId } : undefined

  const reads = useReadContracts({
    // Only query when we have a valid address.
    contracts: contract ? [
      { ...contract, functionName: 'owner' },
      { ...contract, functionName: 'creationFee' },
      { ...contract, functionName: 'maxCreationFee' },
      { ...contract, functionName: 'founderFeeRecipient' },
      { ...contract, functionName: 'communityFeeRecipient' },
      { ...contract, functionName: 'founderFeeShareBps' },
      { ...contract, functionName: 'maxFounderFeeShareBps' },
      { ...contract, functionName: 'totalLocks' },
      { ...contract, functionName: 'totalActiveLocks' },
      { ...contract, functionName: 'totalPermanentLocks' },
      { ...contract, functionName: 'totalFeesCollected' },
    ] : [],
    query: { enabled: !!contract },
  })

  const r = reads.data
  const owner = r?.[0]?.result as Address | undefined
  const creationFee = r?.[1]?.result as bigint | undefined
  const maxCreationFee = r?.[2]?.result as bigint | undefined
  const founderRecipient = r?.[3]?.result as Address | undefined
  const communityRecipient = r?.[4]?.result as Address | undefined
  const founderShareBps = r?.[5]?.result as number | undefined
  const maxFounderShareBps = r?.[6]?.result as number | undefined
  const totalLocks = r?.[7]?.result as bigint | undefined
  const totalActive = r?.[8]?.result as bigint | undefined
  const totalPermanent = r?.[9]?.result as bigint | undefined
  const totalFees = r?.[10]?.result as bigint | undefined

  const isOwner = !!(address && owner && address.toLowerCase() === owner.toLowerCase())
  const wrongNetwork = isConnected && walletChainId !== chainId

  // ── Write handling ─────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()
  const { isLoading: txConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (txConfirmed) reads.refetch()
  }, [txConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  const [newFee, setNewFee] = useState('')
  const [newFounder, setNewFounder] = useState('')
  const [newCommunity, setNewCommunity] = useState('')
  const [newShareBps, setNewShareBps] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [stuckToken, setStuckToken] = useState('')
  const [confirmRenounce, setConfirmRenounce] = useState('')

  function write(functionName: string, args: any[] = []) {
    if (!contract) return
    reset()
    writeContract({ address: contract.address, abi: lockerAdminAbi, functionName, args, chainId } as any)
  }

  const disabled = !contract || !isOwner || wrongNetwork || isPending || txConfirming

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 4px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <img src="/logo.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Admin Panel</h1>
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: 22 }}>
        View live contract configuration and manage owner-only settings for the Genesis Locker contract.
      </p>

      {/* Target selector */}
      <section style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
          <label style={fieldWrap}>
            <span style={labelStyle}>Chain</span>
            <select value={chainId} onChange={e => setChainId(Number(e.target.value))} style={inputStyle}>
              {CHAIN_CONFIGS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={fieldWrap}>
            <span style={labelStyle}>Locker contract address</span>
            <input
              value={contractAddress}
              onChange={e => setContractAddress(e.target.value.trim())}
              placeholder="0x… (auto-filled from API when available)"
              style={{ ...inputStyle, fontFamily: 'monospace', borderColor: contractAddress && !validContract ? 'var(--danger)' : undefined }}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
          <button style={ghostBtn} onClick={() => reads.refetch()} disabled={!contract}>
            <RefreshCw size={13} /> Refresh
          </button>
          {wrongNetwork && (
            <button style={ghostBtn} onClick={() => switchChain({ chainId })}>
              Switch wallet to {chain.name}
            </button>
          )}
        </div>
      </section>

      {/* Owner status banner */}
      {contract && isConnected && (
        <div style={{
          ...cardStyle,
          borderColor: isOwner ? 'rgba(55,213,159,.4)' : 'rgba(225,183,92,.4)',
          background: isOwner ? 'rgba(55,213,159,.06)' : 'rgba(225,183,92,.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {isOwner ? <Check size={16} color="var(--success)" /> : <ShieldAlert size={16} color="var(--warning)" />}
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {isOwner
              ? 'Connected wallet is the contract owner — write actions are enabled.'
              : `Connected wallet is not the owner (${short(owner)}). You have read-only access.`}
          </span>
        </div>
      )}

      {/* Read section */}
      <section style={cardStyle}>
        <h2 style={h2Style}>Contract State (read)</h2>
        {!contract && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Enter a valid contract address to load state.</p>}
        {contract && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <ReadRow label="Owner" value={short(owner)} title={owner} />
            <ReadRow label="Creation fee" value={creationFee !== undefined ? `${formatEther(creationFee)} ${chain.symbol}` : '—'} />
            <ReadRow label="Max fee cap" value={maxCreationFee !== undefined ? `${formatEther(maxCreationFee)} ${chain.symbol}` : '—'} />
            <ReadRow label="Founder recipient" value={short(founderRecipient)} title={founderRecipient} />
            <ReadRow label="Community recipient" value={short(communityRecipient)} title={communityRecipient} />
            <ReadRow label="Founder share" value={founderShareBps !== undefined ? `${(founderShareBps / 100).toFixed(2)}%` : '—'} />
            <ReadRow label="Max founder share" value={maxFounderShareBps !== undefined ? `${(maxFounderShareBps / 100).toFixed(2)}%` : '—'} />
            <ReadRow label="Total fees collected" value={totalFees !== undefined ? `${formatEther(totalFees)} ${chain.symbol}` : '—'} />
            <ReadRow label="Total locks" value={totalLocks?.toString() ?? '—'} />
            <ReadRow label="Active locks" value={totalActive?.toString() ?? '—'} />
            <ReadRow label="Permanent locks" value={totalPermanent?.toString() ?? '—'} />
          </div>
        )}
      </section>

      {/* Tx status */}
      {(isPending || txConfirming || txConfirmed || error) && (
        <div style={{ ...cardStyle, fontSize: 13 }}>
          {isPending && <span>Awaiting wallet confirmation…</span>}
          {txConfirming && <span>Transaction submitted, waiting for confirmation…</span>}
          {txConfirmed && <span style={{ color: 'var(--success)' }}><Check size={13} /> Confirmed. State refreshed.</span>}
          {error && <span style={{ color: 'var(--danger)' }}><AlertTriangle size={13} /> {(error as any).shortMessage || error.message}</span>}
        </div>
      )}

      {/* Owner writes */}
      <section style={cardStyle}>
        <h2 style={h2Style}>Owner Controls (write)</h2>

        <WriteRow label="Set creation fee" hint={`Must be ≤ max cap (${maxCreationFee !== undefined ? formatEther(maxCreationFee) : '?'} ${chain.symbol})`}>
          <input style={inputStyle} placeholder={`New fee in ${chain.symbol}, e.g. 0.02`} value={newFee} onChange={e => setNewFee(e.target.value)} />
          <button style={goldBtn} disabled={disabled || !newFee} onClick={() => write('setCreationFee', [parseEther(newFee || '0')])}>Update</button>
        </WriteRow>

        <WriteRow label="Set fee recipients" hint="Founder and community payout addresses">
          <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Founder recipient 0x…" value={newFounder} onChange={e => setNewFounder(e.target.value.trim())} />
          <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Community recipient 0x…" value={newCommunity} onChange={e => setNewCommunity(e.target.value.trim())} />
          <button style={goldBtn} disabled={disabled || !isAddress(newFounder) || !isAddress(newCommunity)} onClick={() => write('setFeeRecipients', [newFounder as Address, newCommunity as Address])}>Update</button>
        </WriteRow>

        <WriteRow label="Set founder fee share" hint={`In basis points (100 = 1%). Max ${maxFounderShareBps ?? '?'} bps`}>
          <input style={inputStyle} placeholder="e.g. 2000 for 20%" value={newShareBps} onChange={e => setNewShareBps(e.target.value)} />
          <button style={goldBtn} disabled={disabled || !newShareBps} onClick={() => write('setFounderFeeShareBps', [Number(newShareBps)])}>Update</button>
        </WriteRow>

        <WriteRow label="Recover stuck ETH" hint="Sends surplus ETH to the owner. Callable by anyone.">
          <button style={goldBtn} disabled={!contract || wrongNetwork || isPending || txConfirming} onClick={() => write('withdrawStuckETH')}>Recover ETH</button>
        </WriteRow>

        <WriteRow label="Recover stuck token" hint="Sends only the surplus above locked balances to the owner. Callable by anyone.">
          <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="Token address 0x…" value={stuckToken} onChange={e => setStuckToken(e.target.value.trim())} />
          <button style={goldBtn} disabled={!contract || wrongNetwork || isPending || txConfirming || !isAddress(stuckToken)} onClick={() => write('withdrawStuckToken', [stuckToken as Address])}>Recover token</button>
        </WriteRow>
      </section>

      {/* Danger zone */}
      <section style={{ ...cardStyle, borderColor: 'rgba(239,68,68,.35)' }}>
        <h2 style={{ ...h2Style, color: 'var(--danger)' }}>Danger Zone</h2>

        <WriteRow label="Transfer ownership" hint="Hands full admin control to a new address.">
          <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="New owner 0x…" value={newOwner} onChange={e => setNewOwner(e.target.value.trim())} />
          <button style={dangerBtn} disabled={disabled || !isAddress(newOwner)} onClick={() => write('transferOwnership', [newOwner as Address])}>Transfer</button>
        </WriteRow>

        <WriteRow label="Renounce ownership" hint="Permanently gives up admin control. Fee settings freeze and stuck-fund recovery is disabled forever. Type RENOUNCE to confirm.">
          <input style={inputStyle} placeholder="Type RENOUNCE" value={confirmRenounce} onChange={e => setConfirmRenounce(e.target.value)} />
          <button style={dangerBtn} disabled={disabled || confirmRenounce !== 'RENOUNCE'} onClick={() => write('renounceOwnership')}>Renounce</button>
        </WriteRow>
      </section>
    </div>
  )
}

function ReadRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }} title={title}>{value}</span>
    </div>
  )
}

function WriteRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  )
}

const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 16 }
const h2Style: React.CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--accent-2, #e5feaa)' }
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
const labelStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }
const inputStyle: React.CSSProperties = { flex: 1, minWidth: 180, height: 38, padding: '0 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13.5 }
const goldBtn: React.CSSProperties = { height: 38, padding: '0 16px', background: 'linear-gradient(180deg,#e5feaa,#d5fd51)', color: '#100d05', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const dangerBtn: React.CSSProperties = { height: 38, padding: '0 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', background: 'rgba(221,179,83,.06)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
