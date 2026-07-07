import React, { useEffect, useRef, useState } from 'react'
import { Lock, Plus, Info, ChevronDown, Loader2, Globe, Twitter, MessageCircle, Hash, Upload, X, Image, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useBalance } from 'wagmi'
import { api, uploadImage } from '../lib/api'
import { CHAIN_CONFIGS, mergeWithApiChains, getChainById, type ChainConfig } from '../lib/chains'
import { connectWallet, createLockTransaction, switchChain } from '../lib/wallet'
import { detectAssetOnChain, type DetectedAsset } from '../lib/assetDetection'

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
type UploadState = 'idle' | 'compressing' | 'uploading' | 'done' | 'error'

function formatReserve(n: string) {
  const num = parseFloat(n)
  if (!Number.isFinite(num)) return n
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
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
  const [detectError, setDetectError] = useState('')
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detectRequestId = useRef(0)

  // Lock params
  const [tab, setTab] = useState<AssetTab>('lp')
  const [mode, setMode] = useState<LockMode>('cliff')
  const [chain, setChain] = useState<ChainConfig>(CHAIN_CONFIGS[0])
  const [amount, setAmount] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [unlockDate, setUnlockDate] = useState('')
  const [cliffDate, setCliffDate] = useState('')
  const [vestingEnd, setVestingEnd] = useState('')
  const [vestingInterval, setVestingInterval] = useState('Monthly')
  const [permanent, setPermanent] = useState(false)
  const [apiChains, setApiChains] = useState<ReturnType<typeof mergeWithApiChains>>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Social profile — entirely user-supplied. Nothing here is ever auto-filled
  // from a lookup; there is no registry of "known projects" to guess from.
  const [socialExpanded, setSocialExpanded] = useState(false)
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

  // Derived asset address from detection. A given address is unambiguously
  // either a pair or a plain token on-chain — there is no "choice" between the
  // two the way the old mock data pretended there was.
  const asset = detected ? (detected.pair ? detected.pair.address : detected.token!.address) : ''

  // Wallet balance for the selected asset
  const { data: tokenBalance, isLoading: balanceLoading } = useBalance({
    address: walletAddress,
    token: (asset || undefined) as `0x${string}` | undefined,
    query: { enabled: isConnected && asset.length === 42 },
  })

  useEffect(() => {
    api.chains().then(data => setApiChains(mergeWithApiChains(data))).catch(() => setApiChains([]))
  }, [])

  // Debounced address detection — performs a real RPC lookup against the
  // selected chain (ERC20 read for tokens, token0/token1/getReserves for LP
  // pairs). No fabricated data: an address that doesn't resolve to either on
  // this chain surfaces a clear error instead of guessing.
  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current)
    const addr = rawAddress.trim()

    if (addr.length < 42) {
      setDetected(null)
      setDetecting(false)
      setDetectError('')
      return
    }

    setDetecting(true)
    setDetectError('')
    detectTimer.current = setTimeout(() => {
      const requestId = ++detectRequestId.current
      detectAssetOnChain(addr, selectedChain)
        .then(result => {
          if (requestId !== detectRequestId.current) return // stale response (chain/address changed since)
          setDetected(result)
          setDetecting(false)
          if (result) {
            setTab(result.pair ? 'lp' : 'token')
          } else {
            setDetectError(`Not a recognized token or LP pair on ${selectedChain.name}`)
          }
        })
        .catch(() => {
          if (requestId !== detectRequestId.current) return
          setDetected(null)
          setDetecting(false)
          setDetectError('Failed to read this address — check your connection and try again')
        })
    }, 700)

    return () => { if (detectTimer.current) clearTimeout(detectTimer.current) }
  }, [rawAddress, selectedChain])

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
      // Show the compressed image immediately while the real upload is in flight.
      setSocial(s => ({ ...s, [field]: result.dataUrl }))
      setMeta({
        name: file.name,
        originalKB: Math.round(result.originalBytes / 1024),
        compressedKB: Math.round(result.compressedBytes / 1024),
      })
      setUpload('uploading')
      const hostedUrl = await uploadImage(result.dataUrl)
      // Swap the preview to the real hosted URL — this is what actually gets
      // submitted in the lock's metadata, never the raw base64 blob.
      setSocial(s => ({ ...s, [field]: hostedUrl }))
      setUpload('done')
    } catch (err) {
      setSocial(s => ({ ...s, [field]: '' }))
      setErr(err instanceof Error ? err.message : 'Upload failed')
      setUpload('error')
    }
  }

  function clearImage(field: 'logo' | 'banner') {
    setSocial(s => ({ ...s, [field]: '' }))
    if (field === 'logo') { setLogoUpload('idle'); setLogoMeta(null); setLogoErr(''); if (logoInputRef.current) logoInputRef.current.value = '' }
    else { setBannerUpload('idle'); setBannerMeta(null); setBannerErr(''); if (bannerInputRef.current) bannerInputRef.current.value = '' }
  }

  function buildMetadataURI(): string {
    const name = detected?.pair
      ? `${detected.pair.token0.symbol}/${detected.pair.token1.symbol}`
      : detected?.token?.name || ''
    const symbol = detected?.pair
      ? `${detected.pair.token0.symbol}/${detected.pair.token1.symbol}`
      : detected?.token?.symbol || ''
    const meta = {
      name, symbol,
      logo: social.logo || undefined,
      banner: social.banner || undefined,
      website: social.website || undefined,
      twitter: social.twitter || undefined,
      telegram: social.telegram || undefined,
      discord: social.discord || undefined,
      description: social.description || undefined,
    }
    // Skip embedding anything if the user left every optional field empty.
    const hasContent = Object.entries(meta).some(([key, v]) => key !== 'name' && key !== 'symbol' && v)
    if (!hasContent) return ''
    const json = JSON.stringify(meta)
    return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`
  }

  async function submitLock() {
    try {
      setError('')

      if (logoUpload === 'compressing' || logoUpload === 'uploading') throw new Error('Wait for the logo upload to finish')
      if (bannerUpload === 'compressing' || bannerUpload === 'uploading') throw new Error('Wait for the banner upload to finish')

      if (!permanent && mode === 'vesting') {
        if (!cliffDate) throw new Error('Cliff date is required for vesting locks')
        if (!vestingEnd) throw new Error('Vesting end date is required')
        if (dateToUnix(cliffDate) > dateToUnix(vestingEnd)) throw new Error('Cliff date must be on or before the vesting end date')
      }
      if (!permanent && mode === 'cliff' && !unlockDate) {
        throw new Error('Unlock date is required')
      }

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
        cliffTime: !permanent && mode === 'vesting' ? dateToUnix(cliffDate) : undefined,
        endTime: !permanent && mode === 'vesting' ? dateToUnix(vestingEnd) : undefined,
        vestingInterval: VESTING_SECONDS[vestingInterval],
        metadataURI: buildMetadataURI(),
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
                Paste a token contract or a Uniswap V2-style LP pair address — we read it directly from {selectedChain.name} to identify which one it is.
              </div>
            </div>

            {/* Detection error */}
            <AnimatePresence>
              {detectError && !detecting && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 14, border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10,
                    background: 'rgba(239,68,68,0.06)', padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)',
                  }}>
                    {detectError}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                    {detected.token && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
                            <span>{selectedChain.name}</span>
                            <span>·</span>
                            <span style={{ fontFamily: 'monospace' }}>{rawAddress.slice(0, 6)}...{rawAddress.slice(-4)}</span>
                          </div>
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                          background: 'rgba(217, 173, 74,0.12)', color: 'var(--accent)', flexShrink: 0,
                        }}>
                          TOKEN
                        </div>
                      </div>
                    )}

                    {detected.pair && (
                      <div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div
                            className="asset-avatar"
                            style={{ width: 40, height: 40, background: '#242018', color: '#f1cb73', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                          >
                            {detected.pair.token0.symbol.slice(0, 1)}{detected.pair.token1.symbol.slice(0, 1)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                              {detected.pair.token0.symbol} / {detected.pair.token1.symbol}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>LP Pair</span>
                              <span>·</span>
                              <span>{selectedChain.name}</span>
                              <span>·</span>
                              <span style={{ fontFamily: 'monospace' }}>{rawAddress.slice(0, 6)}...{rawAddress.slice(-4)}</span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                            background: 'rgba(217, 173, 74,0.12)', color: 'var(--accent)', flexShrink: 0,
                          }}>
                            LP PAIR
                          </div>
                        </div>
                        <div style={{
                          marginTop: 10, background: 'rgba(221, 179, 83,0.05)', borderRadius: 7, padding: '8px 11px',
                          fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 10,
                        }}>
                          <span>Pool reserves (read live from the chain, not priced):</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 7, padding: '8px 10px', fontSize: 12 }}>
                            <span style={{ color: 'var(--dim)' }}>{detected.pair.token0.symbol}</span>{' '}
                            <strong style={{ color: 'var(--text)' }}>{formatReserve(detected.pair.reserve0)}</strong>
                          </div>
                          <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 7, padding: '8px 10px', fontSize: 12 }}>
                            <span style={{ color: 'var(--dim)' }}>{detected.pair.token1.symbol}</span>{' '}
                            <strong style={{ color: 'var(--text)' }}>{formatReserve(detected.pair.reserve1)}</strong>
                          </div>
                        </div>
                      </div>
                    )}
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
                  <div className="field form-full" style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                    background: 'rgba(221, 179, 83,0.05)', border: '1px solid var(--border)', borderRadius: 8,
                  }}>
                    <Info size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Vesting starts the moment this transaction confirms — there's no separate start date to set.
                    </span>
                  </div>

                  <div className="field">
                    <label>Cliff Date</label>
                    <input
                      type="date"
                      value={cliffDate}
                      onChange={e => setCliffDate(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>
                      Nothing can be withdrawn before this date, even once vesting math says some has accrued.
                    </div>
                  </div>

                  <div className="field">
                    <label>Vesting End Date</label>
                    <input
                      type="date"
                      value={vestingEnd}
                      onChange={e => setVestingEnd(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>
                      The full amount is unlocked (100% vested) by this date.
                    </div>
                  </div>

                  <div className="field form-full">
                    <label>Unlock Interval</label>
                    <select value={vestingInterval} onChange={e => setVestingInterval(e.target.value)}>
                      {VESTINGS.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>
                      {vestingEnd ? (() => {
                        const durationSeconds = dateToUnix(vestingEnd) - Math.floor(Date.now() / 1000)
                        const intervalSeconds = VESTING_SECONDS[vestingInterval]
                        if (durationSeconds <= 0) return 'Vesting end date must be in the future.'
                        const pct = Math.min(100, (intervalSeconds / durationSeconds) * 100)
                        return `Vesting is linear and calculated in ${vestingInterval.toLowerCase()} steps — roughly ${pct.toFixed(1)}% of the total becomes newly withdrawable each step, once past the cliff.`
                      })() : 'Set a vesting end date to see how much unlocks per interval.'}
                    </div>
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
                            {logoUpload === 'compressing' || logoUpload === 'uploading' ? (
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
                            {bannerUpload === 'compressing' || bannerUpload === 'uploading' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
                                  <Loader2 size={16} color="var(--accent)" />
                                </motion.span>
                                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{bannerUpload === 'compressing' ? 'Compressing...' : 'Uploading...'}</span>
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
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f1cb73' }}>{(detected?.token?.symbol || detected?.pair?.token0.symbol || '?').slice(0, 2)}</span>
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{detected?.token?.name || (detected?.pair ? `${detected.pair.token0.symbol}/${detected.pair.token1.symbol}` : 'Project')}</div>
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
                <span className="summary-row-label">{detected.pair ? 'Pair' : 'Token'}</span>
                <span className="summary-row-val">
                  {detected.pair ? `${detected.pair.token0.symbol}/${detected.pair.token1.symbol}` : detected.token!.symbol}
                  {' '}({selectedChain.name})
                </span>
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
