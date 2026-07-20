import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Coins, FileCheck2, Infinity, Layers, Loader2, Lock, Search, ShieldCheck } from 'lucide-react'
import { useAccount, useBalance } from 'wagmi'
import { api } from '../lib/api'
import { CHAIN_CONFIGS, getChainById, mergeWithApiChains, type ChainConfig } from '../lib/chains'
import { detectAssetOnChain, type DetectedAsset } from '../lib/assetDetection'
import { connectWallet, createLockTransaction, switchChain } from '../lib/wallet'

type AssetChoice = 'token' | 'liquidity'
type LockKind = 'timed' | 'vesting' | 'permanent'
type TxStep = 'idle' | 'wallet' | 'approval' | 'approvalConfirmed' | 'locking' | 'confirmed'

const VESTING_PRESETS = {
  team: { label: 'Team vesting', cliffDays: 180, releaseDays: 720, frequency: 'Monthly' },
  advisor: { label: 'Advisor vesting', cliffDays: 90, releaseDays: 365, frequency: 'Monthly' },
  privateSale: { label: 'Private-sale vesting', cliffDays: 30, releaseDays: 180, frequency: 'Weekly' },
  custom: { label: 'Custom', cliffDays: 0, releaseDays: 0, frequency: 'Monthly' },
} as const

const VESTING_SECONDS: Record<string, number> = {
  Daily: 86400,
  Weekly: 604800,
  Monthly: 2592000,
  Quarterly: 7776000,
}

function toUnix(dateTime: string) {
  return Math.floor(new Date(dateTime).getTime() / 1000)
}

function asDateInput(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  date.setSeconds(0, 0)
  return date.toISOString().slice(0, 16)
}

function short(value?: string | null) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '-'
}

function assetName(asset: DetectedAsset | null) {
  if (!asset) return 'No asset selected'
  if (asset.pair) return `${asset.pair.token0.symbol}/${asset.pair.token1.symbol}`
  return `${asset.token?.symbol || 'Token'}`
}

function StepPill({ active, done, children }: { active?: boolean; done?: boolean; children: React.ReactNode }) {
  return <span className={`step-pill${active ? ' active' : ''}${done ? ' done' : ''}`}>{children}</span>
}

export function CreateLock() {
  const { address: walletAddress, isConnected } = useAccount()
  const [apiChains, setApiChains] = useState<ReturnType<typeof mergeWithApiChains>>([])
  const [chain, setChain] = useState<ChainConfig>(CHAIN_CONFIGS[0])
  const [choice, setChoice] = useState<AssetChoice>('token')
  const [rawAddress, setRawAddress] = useState('')
  const [detected, setDetected] = useState<DetectedAsset | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [lockKind, setLockKind] = useState<LockKind>('timed')
  const [amount, setAmount] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [unlockDate, setUnlockDate] = useState(asDateInput(30))
  const [label, setLabel] = useState('')
  const [preset, setPreset] = useState<keyof typeof VESTING_PRESETS>('team')
  const [vestingStart, setVestingStart] = useState(asDateInput(0))
  const [cliffDate, setCliffDate] = useState(asDateInput(180))
  const [vestingEnd, setVestingEnd] = useState(asDateInput(720))
  const [frequency, setFrequency] = useState('Monthly')
  const [ackPermanent, setAckPermanent] = useState(false)
  const [error, setError] = useState('')
  const [txStep, setTxStep] = useState<TxStep>('idle')
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detectRequest = useRef(0)

  const chainOptions = apiChains.length > 0 ? apiChains : CHAIN_CONFIGS
  const selectedChain = getChainById(chain.id) ?? CHAIN_CONFIGS[0]
  const selectedApiChain = apiChains.find(c => c.id === chain.id)
  const lockerAddress = selectedApiChain?.contractAddress || ''
  const assetAddress = detected?.pair?.address || detected?.token?.address || ''
  const isLp = Boolean(detected?.pair)
  const supportedKinds: LockKind[] = isLp ? ['timed', 'permanent'] : ['timed', 'vesting', 'permanent']

  const { data: balance } = useBalance({
    address: walletAddress,
    token: (assetAddress || undefined) as `0x${string}` | undefined,
    query: { enabled: isConnected && assetAddress.length === 42 },
  })

  useEffect(() => {
    api.chains().then(data => setApiChains(mergeWithApiChains(data))).catch(() => setApiChains([]))
  }, [])

  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current)
    setDetected(null)
    setDetectError('')
    const address = rawAddress.trim()
    if (address.length < 42) return

    setDetecting(true)
    detectTimer.current = setTimeout(() => {
      const requestId = ++detectRequest.current
      detectAssetOnChain(address, selectedChain)
        .then(result => {
          if (requestId !== detectRequest.current) return
          setDetecting(false)
          if (!result) {
            setDetectError(`Unsupported or invalid asset on ${selectedChain.name}`)
            return
          }
          setDetected(result)
          setChoice(result.pair ? 'liquidity' : 'token')
          setLockKind(result.pair && lockKind === 'vesting' ? 'timed' : lockKind)
        })
        .catch(() => {
          if (requestId !== detectRequest.current) return
          setDetecting(false)
          setDetectError('We could not read this asset. Check the network and contract address, then try again.')
        })
    }, 550)

    return () => { if (detectTimer.current) clearTimeout(detectTimer.current) }
  }, [rawAddress, selectedChain])

  useEffect(() => {
    const selected = VESTING_PRESETS[preset]
    setFrequency(selected.frequency)
    if (preset !== 'custom') {
      setCliffDate(asDateInput(selected.cliffDays))
      setVestingEnd(asDateInput(selected.releaseDays))
    }
  }, [preset])

  const reviewRows = useMemo(() => {
    const rows = [
      ['Asset', assetName(detected)],
      ['Asset type', isLp ? 'V2 liquidity position' : detected ? 'ERC20 token' : '-'],
      ['Lock type', lockKind === 'timed' ? 'Timed Lock' : lockKind === 'vesting' ? 'Vesting' : 'Permanent Lock'],
      ['Amount', amount || '-'],
      ['Locker fee', selectedChain.feeLabel || 'Unavailable'],
      ['Estimated network fee', 'Estimated in wallet'],
      ['Total native amount required', selectedChain.feeLabel ? `${selectedChain.feeLabel} plus gas` : 'Unavailable'],
    ]
    if (lockKind !== 'permanent') rows.splice(4, 0, ['Beneficiary', beneficiary || walletAddress || '-'])
    if (lockKind === 'timed') rows.splice(5, 0, ['Unlock date', unlockDate ? new Date(unlockDate).toLocaleString() : '-'])
    if (lockKind === 'vesting') {
      rows.splice(5, 0, ['Cliff end', cliffDate ? new Date(cliffDate).toLocaleString() : '-'])
      rows.splice(6, 0, ['Final release', vestingEnd ? new Date(vestingEnd).toLocaleString() : '-'])
      rows.splice(7, 0, ['Release frequency', frequency])
    }
    return rows
  }, [detected, isLp, lockKind, amount, selectedChain.feeLabel, beneficiary, walletAddress, unlockDate, cliffDate, vestingEnd, frequency])

  function validate() {
    if (!detected || !assetAddress) throw new Error('Choose a supported token or V2 LP asset first')
    if (!lockerAddress) throw new Error(`No Genesis Locker contract configured for ${selectedChain.name}`)
    if (!amount || Number(amount) <= 0) throw new Error('Enter a lock amount')
    if (lockKind !== 'permanent' && !(beneficiary || walletAddress)) throw new Error('Beneficiary is required')
    if (beneficiary === '0x0000000000000000000000000000000000000000') throw new Error('Beneficiary cannot be the zero address')
    if (lockKind === 'timed' && toUnix(unlockDate) <= Math.floor(Date.now() / 1000)) throw new Error('Unlock date must be in the future')
    if (lockKind === 'vesting') {
      if (toUnix(cliffDate) > toUnix(vestingEnd)) throw new Error('Cliff must be on or before final release')
      if (!VESTING_SECONDS[frequency]) throw new Error('Unsupported release frequency')
    }
    if (lockKind === 'permanent' && !ackPermanent) throw new Error('Confirm that withdrawal does not exist for this lock')
  }

  async function submitLock() {
    try {
      setError('')
      validate()
      setTxStep('wallet')
      const wallet = await connectWallet()
      if (wallet.chainId !== selectedChain.id) await switchChain(selectedChain.id)
      setTxStep('approval')

      const tx = await createLockTransaction({
        contractAddress: lockerAddress,
        tokenAddress: assetAddress,
        beneficiary: beneficiary || wallet.address,
        amount,
        isLpToken: isLp,
        isVesting: lockKind === 'vesting',
        unlockTime: lockKind === 'permanent' ? Math.floor(Date.now() / 1000) + 8 * 24 * 60 * 60 : toUnix(unlockDate),
        cliffTime: lockKind === 'vesting' ? toUnix(cliffDate) : undefined,
        endTime: lockKind === 'vesting' ? toUnix(vestingEnd) : undefined,
        vestingInterval: VESTING_SECONDS[frequency],
        metadataURI: label.trim() ? `data:application/json;base64,${btoa(JSON.stringify({ label: label.trim() }))}` : '',
        permanent: lockKind === 'permanent',
        onApprovalConfirmed: () => setTxStep('approvalConfirmed'),
        onLockSubmitted: () => setTxStep('locking'),
      })
      if (txStep !== 'locking') setTxStep('locking')
      await tx.wait()
      setTxStep('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lock')
      setTxStep('idle')
    }
  }

  return (
    <div className="create-page unified-create">
      <div className="page-heading">
        <h1 className="page-title">Create Lock</h1>
        <p className="page-desc">Choose an asset. Genesis Locker detects the supported lock options from on-chain facts.</p>
      </div>

      <div className="create-stepper" aria-label="Create lock steps">
        <StepPill active>Choose asset</StepPill>
        <StepPill done={!!detected} active={!!detected}>Choose lock type</StepPill>
        <StepPill done={!!amount}>Enter details</StepPill>
        <StepPill>Review</StepPill>
        <StepPill>Approve and lock</StepPill>
      </div>

      <div className="unified-create-grid">
        <section className="form-card create-panel">
          <div className="form-section-title">What do you want to lock?</div>
          <div className="asset-choice-grid">
            <button className={`asset-choice${choice === 'token' ? ' selected' : ''}`} onClick={() => setChoice('token')} type="button">
              <Coins size={18} />
              <span>Token</span>
            </button>
            <button className={`asset-choice${choice === 'liquidity' ? ' selected' : ''}`} onClick={() => setChoice('liquidity')} type="button">
              <Layers size={18} />
              <span>Liquidity Position</span>
            </button>
          </div>

          <div className="field">
            <label>Network</label>
            <div className="chain-pill-row">
              {chainOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`chain-pill${chain.id === option.id ? ' active' : ''}`}
                  onClick={() => {
                    setChain(getChainById(option.id) ?? CHAIN_CONFIGS[0])
                    setRawAddress('')
                    setDetected(null)
                  }}
                >
                  <span style={{ background: option.dotColor ?? '#8c918b' }} />
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          {choice === 'liquidity' && (
            <div className="v3-note">
              <ShieldCheck size={16} />
              <div>
                <strong>Genesis launch positions are automatic.</strong>
                <span>Launch-created liquidity positions are permanently recorded in Genesis Locker when the market opens. Manual position locking is not available from this form yet.</span>
              </div>
            </div>
          )}

          <div className="field">
            <label>{choice === 'token' ? 'Token contract address' : 'Token or V2 LP contract address'}</label>
            <div className="input-with-icon">
              <Search size={14} />
              <input value={rawAddress} onChange={event => setRawAddress(event.target.value.trim())} placeholder="0x..." />
              {detecting && <Loader2 size={14} className="spin" />}
            </div>
          </div>

          {detectError && <div className="form-alert error">{detectError}</div>}
          {detected && (
            <div className="detected-asset-panel">
              <div>
                <div className="detected-title">{assetName(detected)}</div>
                <div className="detected-meta">{isLp ? 'Supported Uniswap V2-style LP' : 'ERC20 token'} on {selectedChain.name}</div>
              </div>
              <CheckCircle2 size={18} color="var(--success)" />
              {detected.pair && (
                <div className="detected-grid">
                  <span>Token 0</span><strong>{detected.pair.token0.symbol} {short(detected.pair.token0.address)}</strong>
                  <span>Token 1</span><strong>{detected.pair.token1.symbol} {short(detected.pair.token1.address)}</strong>
                </div>
              )}
              <div className="detected-grid">
                <span>Connected-wallet balance</span><strong>{balance ? `${balance.formatted} ${balance.symbol}` : isConnected ? 'Unavailable' : 'Connect wallet'}</strong>
                <span>Verification</span><strong>{isLp ? 'Pair interface verified' : 'ERC20 metadata verified'}</strong>
              </div>
            </div>
          )}

          <div className="form-section-title">Available lock types</div>
          <div className="lock-type-grid">
            {supportedKinds.map(kind => (
              <button key={kind} type="button" className={`lock-type-card${lockKind === kind ? ' selected' : ''}`} onClick={() => setLockKind(kind)}>
                {kind === 'timed' && <Clock size={17} />}
                {kind === 'vesting' && <FileCheck2 size={17} />}
                {kind === 'permanent' && <Infinity size={17} />}
                <span>{kind === 'timed' ? 'Timed Lock' : kind === 'vesting' ? 'Vesting' : 'Permanent Lock'}</span>
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div className="field">
              <label>{isLp ? 'LP amount' : 'Amount'}</label>
              <input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" placeholder="0.0" />
              <div className="percent-row">
                {['25%', '50%', '75%', 'Max'].map(percent => <button key={percent} type="button">{percent}</button>)}
              </div>
            </div>

            {lockKind !== 'permanent' && (
              <div className="field">
                <label>Beneficiary</label>
                <input value={beneficiary} onChange={event => setBeneficiary(event.target.value.trim())} placeholder={walletAddress || '0x...'} />
              </div>
            )}

            {lockKind === 'timed' && (
              <div className="field">
                <label>Unlock date and time</label>
                <input type="datetime-local" value={unlockDate} onChange={event => setUnlockDate(event.target.value)} />
              </div>
            )}

            {lockKind === 'vesting' && (
              <>
                <div className="field">
                  <label>Preset</label>
                  <select value={preset} onChange={event => setPreset(event.target.value as keyof typeof VESTING_PRESETS)}>
                    {Object.entries(VESTING_PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>Vesting start</label><input type="datetime-local" value={vestingStart} onChange={event => setVestingStart(event.target.value)} /></div>
                <div className="field"><label>Cliff</label><input type="datetime-local" value={cliffDate} onChange={event => setCliffDate(event.target.value)} /></div>
                <div className="field"><label>Total release period</label><input type="datetime-local" value={vestingEnd} onChange={event => setVestingEnd(event.target.value)} /></div>
                <div className="field">
                  <label>Release frequency</label>
                  <select value={frequency} onChange={event => setFrequency(event.target.value)}>
                    {Object.keys(VESTING_SECONDS).map(value => <option key={value}>{value}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="field form-full">
              <label>Public label (optional)</label>
              <input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} placeholder="Team allocation, LP proof, advisor vesting..." />
            </div>
          </div>

          {lockKind === 'permanent' && (
            <label className="permanent-ack">
              <input type="checkbox" checked={ackPermanent} onChange={event => setAckPermanent(event.target.checked)} />
              <span>{isLp ? 'These LP tokens can never be withdrawn, transferred or recovered.' : 'These tokens can never be withdrawn by anyone.'}</span>
            </label>
          )}

          {error && <div className="form-alert error">{error}</div>}
          {txStep !== 'idle' && (
            <div className="form-alert">
              {txStep === 'wallet' && 'Waiting for wallet...'}
              {txStep === 'approval' && 'Waiting for approval...'}
              {txStep === 'approvalConfirmed' && 'Approval confirmed. Creating lock...'}
              {txStep === 'locking' && 'Lock submitted. Waiting for confirmation...'}
              {txStep === 'confirmed' && 'Lock confirmed. Your public lock page will appear within a few minutes.'}
            </div>
          )}

          <button className="btn-full" onClick={submitLock}>
            <Lock size={15} />
            Approve and lock
          </button>
        </section>

        <aside className="summary-card review-panel">
          <div className="summary-title">Review</div>
          {reviewRows.map(([key, value]) => (
            <div className="summary-row" key={key}>
              <span className="summary-row-label">{key}</span>
              <span className="summary-row-val">{value}</span>
            </div>
          ))}

          {lockKind === 'vesting' && (
            <div className="schedule-preview">
              <div className="detail-card-label">Schedule preview</div>
              <p>First release occurs after the cliff. Amounts use the contract formula: elapsed full intervals multiplied by amount, divided by total duration.</p>
            </div>
          )}

          {lockKind === 'permanent' && (
            <div className="permanent-warning">
              <AlertTriangle size={16} />
              <span>Withdrawal does not exist for this lock.</span>
            </div>
          )}

          <div className="v3-review-note">
            <strong>Launch position note</strong>
            <span>Genesis launch liquidity positions are permanent and appear on the public locked positions page after indexing. Manual position locking is not available from this form yet.</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
