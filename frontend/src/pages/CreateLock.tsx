import React, { useEffect, useRef, useState } from 'react'
import { Lock, Plus, Info, ChevronDown, CheckCircle, Loader2, Globe, Twitter, MessageCircle, Hash, Upload, X, Image, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useBalance } from 'wagmi'
import { api } from '../lib/api'
import { CHAIN_CONFIGS, mergeWithApiChains, getChainById, type ChainConfig } from '../lib/chains'
import { connectWallet, createLockTransaction, switchChain } from '../lib/wallet'
import { detectAsset, DetectedAsset } from '../lib/projectProfiles'

type AssetTab = 'lp' | 'token'
type LockMode = 'cliff' | 'vesting'

interface SocialProfile {
  logo: string
  banner: string
  website: string
  twitter: string
  telegram: string
  discord: string
  description: string
}

const EMPTY_PROFILE: SocialProfile = {
  logo: '', banner: '', website: '', twitter: '', telegram: '', discord: '', description: '',
}

// Chain list is now fully driven from chains.ts. No hardcoded CHAINS array.

const VESTINGS = ['Daily', 'Weekly', 'Monthly', 'Quarterly']
const VESTING_SECONDS: Record<string, number> = {
  Daily: 86400,
  Weekly: 604800,
  Monthly: 2592000,
  Quarterly: 7776000,
}

function dateToUnix(date: string) {
  return Math.floor(new Date(`${date}T00:00:00`).getTime() / 1000)
}

// ── Image compression ──────────────────────────────────────────────────────
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024   // 2 MB hard limit
const MAX_STORE_BYTES  = 500 * 1024        // 500 KB target after compression

interface CompressResult {
  dataUrl: string
  originalBytes: number
  compressedBytes: number
}

async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
): Promise<CompressResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 2 MB limit')

  const originalBytes = file.size
  const objectUrl = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Constrain dimensions
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, w, h)

      // PNG files that are already small enough stay as PNG; everything else → JPEG
      const usePng = file.type === 'image/png' && file.size <= MAX_STORE_BYTES
      const mime = usePng ? 'image/png' : 'image/jpeg'
      let quality = 0.88

      const attempt = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          if (blob.size <= MAX_STORE_BYTES || quality <= 0.10) {
            const reader = new FileReader()
            reader.onload = e => resolve({
              dataUrl: e.target!.result as string,
              originalBytes,
              compressedBytes: blob!.size,
            })
            reader.readAsDataURL(blob)
          } else {
            quality = Math.max(0.10, quality - 0.10)
            attempt()
          }
        }, mime, quality)
      }
      attempt()
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Invalid image file')) }
    img.src = objectUrl
  })
}

interface ImageMeta { name: string; originalKB: number; compressedKB: number }
type UploadState = 'idle' | 'compressing' | 'done' | 'error'

function formatPrice(n: number) {
  if (n === 0) return '$0.00'
  if (n < 0.00001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

function formatMarketCap(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function CreateLock() {
  // Wallet
  const { address: walletAddress, isConnected } = useAccount()

  // Lock name
  const [lockName, setLockName] = useState('')

  // Address detection
  const [rawAddress, setRawAddress] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedAsset | null>(null)
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lock params
  const [tab, setTab] = useState<AssetTab>('lp')
  const [mode, setMode] = useState<LockMode>('cliff')
  const [chain, setChain] = useState<ChainConfig>(CHAIN_CONFIGS[0])
  const [amount, setAmount] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [unlockDate, setUnlockDate] = useState('')
  const [vestingEnd, setVestingEnd] = useState('')
  const [vestingInterval, setVestingInterval] = useState('Monthly')
  const [permanent, setPermanent] = useState(false)
  const [apiChains, setApiChains] = useState<ReturnType<typeof mergeWithApiChains>>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Social profile
  const [socialExpanded, setSocialExpanded] = useState(false)
  const [profileFound, setProfileFound] = useState(false)
  const [social, setSocial] = useState<SocialProfile>(EMPTY_PROFILE)

  // Image upload state
  const [logoUpload, setLogoUpload] = useState<UploadState>('idle')
  const [bannerUpload, setBannerUpload] = useState<UploadState>('idle')
  const [logoMeta, setLogoMeta] = useState<ImageMeta | null>(null)
  const [bannerMeta, setBannerMeta] = useState<ImageMeta | null>(null)
  const [logoErr, setLogoErr] = useState('')
  const [bannerErr, setBannerErr] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Chain options: merged API data on top of static CHAIN_CONFIGS. Falls back to
  // CHAIN_CONFIGS if the API hasn't loaded yet (so the UI is never empty).
  const chainOptions = apiChains.length > 0 ? apiChains : CHAIN_CONFIGS
  const selectedChain = getChainById(chain.id) ?? CHAIN_CONFIGS[0]
  const selectedApiChain = apiChains.find(c => c.id === chain.id)
  const lockerAddress = selectedApiChain?.contractAddress || ''

  // Derived asset address from detection + tab
  const asset = detected
    ? (tab === 'lp' && detected.lp ? detected.lp.address : detected.token.address)
    : ''

  // Wallet balance for the selected asset
  const { data: tokenBalance, isLoading: balanceLoading } = useBalance({
    address: walletAddress,
    token: (asset || undefined) as `0x${string}` | undefined,
    query: { enabled: isConnected && asset.length === 42 },
  })

  useEffect(() => {
    api.chains().then(data => setApiChains(mergeWithApiChains(data))).catch(() => setApiChains([]))
  }, [])

  // Debounced address detection
  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current)
    const addr = rawAddress.trim()

    if (addr.length < 42) {
      setDetected(null)
      setDetecting(false)
      return
    }

    setDetecting(true)
    detectTimer.current = setTimeout(() => {
      const result = detectAsset(addr)
      setDetected(result)
      setDetecting(false)

      if (result) {
        // Default to LP if LP pair exists, otherwise token
        setTab(result.lp ? 'lp' : 'token')

        // Handle social profile restoration
        if (result.profile) {
          setProfileFound(true)
          setSocialExpanded(true)
          setSocial({
            logo: result.profile.logo,
            banner: result.profile.banner,
            website: result.profile.website,
            twitter: result.profile.twitter,
            telegram: result.profile.telegram,
            discord: result.profile.discord,
            description: result.profile.description,
          })
          // If profile has stored images, mark upload slots as done
          setLogoUpload(result.profile.logo ? 'done' : 'idle')
          setBannerUpload(result.profile.banner ? 'done' : 'idle')
          setLogoMeta(null)
          setBannerMeta(null)
        } else {
          setProfileFound(false)
          setSocial(EMPTY_PROFILE)
          setLogoUpload('idle')
          setBannerUpload('idle')
          setLogoMeta(null)
          setBannerMeta(null)
        }
      }
    }, 700)

    return () => { if (detectTimer.current) clearTimeout(detectTimer.current) }
  }, [rawAddress])

  async function handleImageUpload(field: 'logo' | 'banner', file: File) {
    const isLogo = field === 'logo'
    const setUpload = isLogo ? setLogoUpload : setBannerUpload
    const setMeta   = isLogo ? setLogoMeta   : setBannerMeta
    const setErr    = isLogo ? setLogoErr    : setBannerErr
    const maxW = isLogo ? 400  : 1500
    const maxH = isLogo ? 400  : 500

    setErr('')
    setUpload('compressing')
    try {
      const result = await compressImage(file, maxW, maxH)
      setSocial(s => ({ ...s, [field]: result.dataUrl }))
      setMeta({
        name: file.name,
        originalKB: Math.round(result.originalBytes / 1024),
        compressedKB: Math.round(result.compressedBytes / 1024),
      })
      setUpload('done')
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Upload failed')
      setUpload('error')
    }
  }

  function clearImage(field: 'logo' | 'banner') {
    setSocial(s => ({ ...s, [field]: '' }))
    if (field === 'logo') { setLogoUpload('idle'); setLogoMeta(null); setLogoErr(''); if (logoInputRef.current) logoInputRef.current.value = '' }
    else { setBannerUpload('idle'); setBannerMeta(null); setBannerErr(''); if (bannerInputRef.current) bannerInputRef.current.value = '' }
  }

  async function submitLock() {
    try {
      setError('')
      setStatus('Connecting wallet...')
      const wallet = await connectWallet()
      if (wallet.chainId !== selectedChain.id) {
        setStatus(`Switching to ${selectedChain.name}...`)
        await switchChain(selectedChain.id)
      }
      if (!lockerAddress) throw new Error(`No locker contract configured for ${selectedChain.name}`)
      if (!asset || !amount) throw new Error('Asset address and amount are required')

      const finalBeneficiary = beneficiary || wallet.address
      const now = Math.floor(Date.now() / 1000)
      const minPermanentUnlock = now + 8 * 24 * 60 * 60
      setStatus('Submitting approval and lock transaction...')
      const tx = await createLockTransaction({
        contractAddress: lockerAddress,
        tokenAddress: asset,
        beneficiary: finalBeneficiary,
        amount,
        isLpToken: tab === 'lp',
        isVesting: !permanent && mode === 'vesting',
        unlockTime: permanent ? minPermanentUnlock : dateToUnix(unlockDate),
        cliffTime: !permanent && mode === 'vesting' ? now + 7 * 24 * 60 * 60 : undefined,
        endTime: !permanent && mode === 'vesting' ? dateToUnix(vestingEnd) : undefined,
        vestingInterval: VESTING_SECONDS[vestingInterval],
        metadataURI: '',
        permanent,
      })
      setStatus('Waiting for confirmation...')
      await tx.wait()
      setStatus(
        permanent
          ? 'Permanent lock created. Run the indexer to refresh proof pages.'
          : 'Lock created. Run the indexer to refresh proof pages.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lock')
      setStatus('')
    }
  }

  const lockLabel = `Create ${tab === 'lp' ? 'LP' : 'Token'} ${permanent ? 'Permanent ' : ''}${!permanent ? mode.charAt(0).toUpperCase() + mode.slice(1) + ' ' : ''}Lock`

  return (
    <div className="create-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">Create Lock</h1>
        <p className="page-desc">
          Paste any token contract or LP pair address — we'll detect it automatically.
        </p>
      </motion.div>

      <div className="create-layout">
        {/* Left: form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >

          {/* ── Lock Name (optional) ── */}
          <div className="form-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Tag size={13} color="var(--accent)" />
              <span className="form-section-title" style={{ marginBottom: 0 }}>Lock Name</span>
              <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>optional</span>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                value={lockName}
                onChange={e => setLockName(e.target.value)}
                placeholder="e.g. Advisors Tokens, Marketing Fund, DOGE LP Lock..."
                maxLength={80}
              />
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>
                Describes what this lock is for. Shown on the lock page and in explorer.
              </div>
            </div>
          </div>

          {/* ── Step 1: Chain + Address detection ── */}
          <div className="form-card" style={{ marginBottom: 14 }}>
            <div className="form-section-title">Network &amp; Asset</div>

            {/* Chain pill selector */}
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Select Network</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chainOptions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setChain(getChainById(c.id) ?? CHAIN_CONFIGS[0])
                      // Reset detection when chain changes — same address may not exist on the new chain
                      setRawAddress('')
                      setDetected(null)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: chain.id === c.id ? 600 : 400,
                      border: `1px solid ${chain.id === c.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: chain.id === c.id ? 'rgba(217, 173, 74,0.12)' : 'transparent',
                      color: chain.id === c.id ? 'var(--accent)' : 'var(--muted)',
                      cursor: 'pointer', transition: 'all 150ms',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dotColor ?? '#a9a49a', flexShrink: 0 }} />
                    {c.name}
                    {chain.id === c.id && <span style={{ fontSize: 10, opacity: 0.7 }}>· {c.feeLabel}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Token contract or LP pair address</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={rawAddress}
                  onChange={e => setRawAddress(e.target.value.trim())}
                  placeholder={`0x... paste ${selectedChain.name} token or LP address`}
                  style={{ paddingRight: 40 }}
                />
                {detecting && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'flex' }}
                    >
                      <Loader2 size={14} color="var(--accent)" />
                    </motion.span>
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
                Both token and LP pair addresses work. We'll detect what it is and show you both options.
              </div>
            </div>

            {/* Detected asset card */}
            <AnimatePresence>
              {detected && !detecting && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 14,
                    border: '1px solid rgba(217, 173, 74,0.35)',
                    borderRadius: 10,
                    background: 'rgba(217, 173, 74,0.05)',
                    padding: 14,
                  }}>
                    {/* Token info */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div
                        className="asset-avatar"
                        style={{ width: 40, height: 40, background: '#242018', color: '#f1cb73', fontSize: 14, fontWeight: 700, flexShrink: 0 }}
                      >
                        {detected.token.symbol.slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{detected.token.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>{detected.token.symbol}</span>
                          <span>·</span>
                          <span>{detected.token.chain}</span>
                          <span>·</span>
                          <span style={{ fontFamily: 'monospace' }}>{rawAddress.slice(0, 6)}...{rawAddress.slice(-4)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatPrice(detected.token.priceUsd)}</div>
                        <div style={{ fontSize: 11, color: 'var(--dim)' }}>{formatMarketCap(detected.token.marketCapUsd)} mcap</div>
                      </div>
                    </div>

                    {/* LP pair info */}
                    {detected.lp && (
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 7,
                        padding: '8px 11px',
                        fontSize: 12,
                        color: 'var(--muted)',
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span>
                          LP: <strong style={{ color: 'var(--text)' }}>{detected.lp.token0Symbol}/{detected.lp.token1Symbol}</strong>
                          {' '}on <strong style={{ color: 'var(--text)' }}>{detected.lp.dex}</strong>
                        </span>
                        <span style={{ color: 'var(--dim)' }}>TVL {formatMarketCap(detected.lp.tvlUsd)}</span>
                      </div>
                    )}

                    {/* Lock type selector */}
                    <div style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      What do you want to lock?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setTab('token')}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: `1px solid ${tab === 'token' ? 'var(--accent)' : 'var(--border)'}`,
                          background: tab === 'token' ? 'rgba(217, 173, 74,0.15)' : 'transparent',
                          color: tab === 'token' ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: tab === 'token' ? 700 : 400,
                          cursor: 'pointer',
                          fontSize: 13,
                          transition: 'all 150ms',
                        }}
                      >
                        Token ({detected.token.symbol})
                      </button>
                      {detected.lp && (
                        <button
                          onClick={() => setTab('lp')}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 8,
                            border: `1px solid ${tab === 'lp' ? 'var(--accent)' : 'var(--border)'}`,
                            background: tab === 'lp' ? 'rgba(217, 173, 74,0.15)' : 'transparent',
                            color: tab === 'lp' ? 'var(--accent)' : 'var(--muted)',
                            fontWeight: tab === 'lp' ? 700 : 400,
                            cursor: 'pointer',
                            fontSize: 13,
                            transition: 'all 150ms',
                          }}
                        >
                          LP ({detected.lp.token0Symbol}/{detected.lp.token1Symbol})
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Step 2: Lock type ── */}
          <div className="form-card" style={{ marginBottom: 14 }}>
            <div className="form-section-title">Lock Type</div>
            <div className="lock-type-selector">
              <button
                className={`lock-type-option${mode === 'cliff' ? ' selected' : ''}`}
                onClick={() => { setMode('cliff'); setPermanent(false) }}
              >
                <div className="lock-type-name">Cliff Lock</div>
                <div className="lock-type-desc">Tokens unlock all at once on the specified date.</div>
              </button>
              <button
                className={`lock-type-option${mode === 'vesting' ? ' selected' : ''}`}
                onClick={() => { setMode('vesting'); setPermanent(false) }}
              >
                <div className="lock-type-name">Vesting Lock</div>
                <div className="lock-type-desc">Tokens release gradually over a vesting schedule.</div>
              </button>
            </div>
            <div
              className={`lock-type-option${permanent ? ' selected' : ''}`}
              style={{ marginTop: 0 }}
              onClick={() => setPermanent(p => !p)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="lock-type-name" style={{ color: permanent ? '#4ade80' : undefined }}>
                    Permanent Lock
                  </div>
                  <div className="lock-type-desc">
                    Tokens are locked forever. Withdrawal rights are renounced on-chain.
                  </div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', border: '2px solid',
                  borderColor: permanent ? 'var(--success)' : 'var(--border)',
                  background: permanent ? 'var(--success)' : 'none',
                  flexShrink: 0, transition: 'all 150ms',
                }} />
              </div>
            </div>
          </div>

          {/* ── Step 3: Lock parameters ── */}
          <div className="form-card" style={{ marginBottom: 14 }}>
            <div className="form-section-title">Lock Parameters</div>
            <div className="form-grid">
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Amount</span>
                  {isConnected && detected && (
                    <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>
                      {balanceLoading ? 'Loading...' : tokenBalance
                        ? `Balance: ${parseFloat(tokenBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${tokenBalance.symbol}`
                        : 'Balance: 0'}
                    </span>
                  )}
                  {!isConnected && detected && (
                    <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>Connect wallet to see balance</span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={tab === 'lp' ? 'LP token amount' : 'Token amount'}
                    style={{ paddingRight: isConnected && tokenBalance ? 56 : undefined }}
                  />
                  {isConnected && tokenBalance && parseFloat(tokenBalance.formatted) > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(tokenBalance.formatted)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(217, 173, 74,0.15)', color: 'var(--accent)',
                        border: '1px solid rgba(217, 173, 74,0.35)', borderRadius: 5,
                        padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        letterSpacing: '0.04em',
                      }}
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              <div className="field form-full">
                <label>Beneficiary Address</label>
                <input
                  value={beneficiary}
                  onChange={e => setBeneficiary(e.target.value)}
                  placeholder="0x... (defaults to your wallet)"
                />
              </div>

              {!permanent && mode === 'cliff' && (
                <div className="field form-full">
                  <label>Unlock Date</label>
                  <input
                    type="date"
                    value={unlockDate}
                    onChange={e => setUnlockDate(e.target.value)}
                  />
                </div>
              )}

              {!permanent && mode === 'vesting' && (
                <>
                  <div className="field">
                    <label>Vesting End Date</label>
                    <input
                      type="date"
                      value={vestingEnd}
                      onChange={e => setVestingEnd(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Vesting Interval</label>
                    <select value={vestingInterval} onChange={e => setVestingInterval(e.target.value)}>
                      {VESTINGS.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Step 4: Project profile ── */}
          <div className="form-card" style={{ marginBottom: 14 }}>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setSocialExpanded(x => !x)}
            >
              <div>
                <div className="form-section-title" style={{ marginBottom: 0 }}>Project Profile</div>
                <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3 }}>
                  Optional — logo, socials, and description displayed on your lock page
                </div>
              </div>
              <motion.span
                animate={{ rotate: socialExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', marginTop: 2, flexShrink: 0 }}
              >
                <ChevronDown size={16} color="var(--dim)" />
              </motion.span>
            </div>

            <AnimatePresence>
              {socialExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ overflow: 'hidden' }}
                >
                  {profileFound && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.07)',
                      border: '1px solid rgba(34,197,94,0.25)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}>
                      <CheckCircle size={14} color="var(--success)" />
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                        Profile restored from a previous lock on this contract. Edit any fields below.
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    {/* Hidden file inputs */}
                    <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload('logo', f) }} />
                    <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload('banner', f) }} />

                    {/* Logo + Banner row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>

                      {/* Logo upload zone */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Logo</label>
                        {logoUpload === 'done' && social.logo ? (
                          <div style={{ position: 'relative' }}>
                            <div
                              style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(217, 173, 74,0.4)', cursor: 'pointer' }}
                              onClick={() => logoInputRef.current?.click()}
                              title="Click to replace"
                            >
                              <img src={social.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="logo" />
                            </div>
                            <button
                              onClick={() => clearImage('logo')}
                              style={{ position: 'absolute', top: -4, right: 18, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <X size={10} color="#fff" />
                            </button>
                            {logoMeta && (
                              <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 5, textAlign: 'center', lineHeight: 1.4 }}>
                                {logoMeta.originalKB}KB → {logoMeta.compressedKB}KB
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => logoInputRef.current?.click()}
                            style={{
                              width: 88, height: 88, borderRadius: '50%',
                              border: `2px dashed ${logoUpload === 'error' ? 'var(--danger)' : 'var(--border)'}`,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', gap: 4, transition: 'border-color 150ms',
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            {logoUpload === 'compressing' ? (
                              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
                                <Loader2 size={18} color="var(--accent)" />
                              </motion.span>
                            ) : (
                              <>
                                <Upload size={15} color="var(--dim)" />
                                <span style={{ fontSize: 9, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.3 }}>Upload<br />logo</span>
                              </>
                            )}
                          </div>
                        )}
                        {logoErr && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4, maxWidth: 100 }}>{logoErr}</div>}
                      </div>

                      {/* Banner upload zone */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                          Banner <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>1500 × 500</span>
                        </label>
                        {bannerUpload === 'done' && social.banner ? (
                          <div style={{ position: 'relative' }}>
                            <div
                              style={{ height: 88, borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(217, 173, 74,0.4)', cursor: 'pointer' }}
                              onClick={() => bannerInputRef.current?.click()}
                              title="Click to replace"
                            >
                              <img src={social.banner} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="banner" />
                            </div>
                            <button
                              onClick={() => clearImage('banner')}
                              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <X size={11} color="#fff" />
                            </button>
                            {bannerMeta && (
                              <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 4 }}>
                                ✓ {bannerMeta.name} · {bannerMeta.originalKB}KB → {bannerMeta.compressedKB}KB
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => bannerInputRef.current?.click()}
                            style={{
                              height: 88, borderRadius: 8,
                              border: `2px dashed ${bannerUpload === 'error' ? 'var(--danger)' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                              cursor: 'pointer', transition: 'border-color 150ms',
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            {bannerUpload === 'compressing' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
                                  <Loader2 size={16} color="var(--accent)" />
                                </motion.span>
                                <span style={{ fontSize: 12, color: 'var(--dim)' }}>Compressing...</span>
                              </div>
                            ) : (
                              <>
                                <Image size={18} color="var(--dim)" />
                                <div>
                                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Click to upload banner</div>
                                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>JPG, PNG, WEBP · max 2 MB · auto-compressed to under 500 KB</div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {bannerErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{bannerErr}</div>}
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Globe size={11} color="var(--dim)" /> Website
                        </label>
                        <input
                          value={social.website}
                          onChange={e => setSocial(s => ({ ...s, website: e.target.value }))}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Twitter size={11} color="var(--dim)" /> X (Twitter)
                        </label>
                        <input
                          value={social.twitter}
                          onChange={e => setSocial(s => ({ ...s, twitter: e.target.value }))}
                          placeholder="https://x.com/yourproject"
                        />
                      </div>
                      <div className="field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MessageCircle size={11} color="var(--dim)" /> Telegram
                        </label>
                        <input
                          value={social.telegram}
                          onChange={e => setSocial(s => ({ ...s, telegram: e.target.value }))}
                          placeholder="t.me/..."
                        />
                      </div>
                      <div className="field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Hash size={11} color="var(--dim)" /> Discord
                        </label>
                        <input
                          value={social.discord}
                          onChange={e => setSocial(s => ({ ...s, discord: e.target.value }))}
                          placeholder="discord.gg/..."
                        />
                      </div>
                      <div className="field form-full">
                        <label>Description</label>
                        <textarea
                          value={social.description}
                          onChange={e => setSocial(s => ({ ...s, description: e.target.value }))}
                          placeholder="Brief description of your project (shown on the lock page and in the project directory)..."
                          rows={3}
                          style={{
                            width: '100%', resize: 'vertical', minHeight: 72,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 7, padding: '9px 12px', color: 'var(--text)',
                            fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <div className="form-alert error">{error}</div>}
          {status && <div className="form-alert">{status}</div>}

          <button className="btn-full" onClick={submitLock}>
            <Lock size={14} />
            <Plus size={12} />
            {lockLabel}
          </button>
        </motion.div>

        {/* Right: Summary card */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="summary-card">
            <div className="summary-title">Lock Summary</div>

            {/* Profile preview */}
            {(social.logo || social.website || social.twitter) && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  {social.logo ? (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                      <img src={social.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="logo" onError={e => { e.currentTarget.style.display = 'none' }} />
                    </div>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#242018', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f1cb73' }}>{detected?.token.symbol.slice(0, 2) || '?'}</span>
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{detected?.token.name || 'Project'}</div>
                    {social.website && (
                      <div style={{ fontSize: 11, color: 'var(--accent)' }}>{social.website.replace(/^https?:\/\//, '')}</div>
                    )}
                  </div>
                </div>
                {(social.twitter || social.telegram || social.discord) && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {social.twitter && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--dim)', border: '1px solid var(--border)' }}>
                        {social.twitter}
                      </span>
                    )}
                    {social.telegram && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--dim)', border: '1px solid var(--border)' }}>
                        TG
                      </span>
                    )}
                    {social.discord && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--dim)', border: '1px solid var(--border)' }}>
                        DC
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="summary-row">
              <span className="summary-row-label">Type</span>
              <span className="summary-row-val">{tab === 'lp' ? 'LP Lock' : 'Token Lock'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Mode</span>
              <span className="summary-row-val" style={{ color: permanent ? 'var(--success)' : undefined }}>
                {permanent ? 'Permanent' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Network</span>
              <span className="summary-row-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedChain.dotColor }} />
                {selectedChain.name}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Asset</span>
              <span className="summary-row-val" style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                {asset ? `${asset.slice(0, 6)}...${asset.slice(-4)}` : '—'}
              </span>
            </div>
            {detected && (
              <div className="summary-row">
                <span className="summary-row-label">Token</span>
                <span className="summary-row-val">{detected.token.symbol} ({detected.token.chain})</span>
              </div>
            )}
            <div className="summary-row">
              <span className="summary-row-label">Amount</span>
              <span className="summary-row-val">{amount || '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Unlock</span>
              <span className="summary-row-val" style={{ color: permanent ? 'var(--success)' : undefined }}>
                {permanent ? 'Never (Permanent)' : (unlockDate || vestingEnd || '—')}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Platform Fee</span>
              <span className="summary-row-val">{selectedChain.feeLabel}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Locker Contract</span>
              <span className="summary-row-val" style={{ fontFamily: 'monospace', fontSize: 11, color: lockerAddress ? 'var(--muted)' : 'var(--warning)' }}>
                {lockerAddress ? `${lockerAddress.slice(0, 6)}...${lockerAddress.slice(-4)}` : 'Not configured'}
              </span>
            </div>

            <div className="fee-note">
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent)' }} />
                <span>
                  Fees are collected in the native chain token and split between founder and community treasury.
                  Gas costs are additional.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
