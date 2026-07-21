export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010'
export const GENESIS_API_BASE = (import.meta.env.VITE_GENESIS_API_BASE_URL || 'https://api.genesispad.app/api').replace(/\/$/, '')

/** Uploads a compressed image data URL to the API and returns its permanent hosted URL. */
export async function uploadImage(dataUrl: string): Promise<string> {
  const response = await fetch(`${API_BASE}/v1/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Upload failed (${response.status})`)
  }
  const { url } = await response.json() as { url: string }
  return `${API_BASE}${url}`
}

export type ChainInfo = {
  id: number
  name: string
  symbol: string
  explorerUrl?: string | null
  dotColor?: string | null
  geckoTerminalId?: string | null
  feeLabel?: string | null
  contracts?: Array<{
    address: string
    isRenounced: boolean
    ownerAddress?: string | null
    creationFee?: string | null
  }>
}

export type ApiLock = {
  lockId: string
  chainId: number
  contractAddress: string
  assetAddress: string
  assetType: 'lp' | 'token' | 'v3_position'
  positionManager?: string | null
  positionTokenId?: string | null
  launchTokenAddress?: string | null
  pairedAssetAddress?: string | null
  poolAddress?: string | null
  initialLiquidity?: string | null
  lockType: 'cliff' | 'vesting' | 'permanent'
  owner: string
  beneficiary: string
  amount: string
  withdrawnAmount: string
  remainingLockedAmount: string
  claimableAmount: string
  startDate: string
  cliffDate: string | null
  unlockDate: string | null
  vestingInterval: number | null
  isPermanent: boolean
  metadataURI: string | null
  lockedPercentage: string | null
  tvlUsd: string | null
  valueSource?: 'estimated_fiat' | 'unavailable' | string
  accruedFees?: {
    token0: string | null
    token1: string | null
    valueUsd: string | null
    source: string
    note?: string
  } | null
  feeCollectionHistory?: Array<{
    txHash: string
    txUrl: string | null
    blockNumber: string
    logIndex: number
    createdAt: string
    payload: unknown
  }>
  genesisPadLaunchVerification?: {
    verified: boolean
    source: string
    label: string
    detail: string
  } | null
  token?: {
    name: string | null
    symbol: string | null
    decimals: number | null
    totalSupply: string | null
    hasMintRisk: boolean
    hasHighTaxRisk: boolean
    hasBlacklistRisk: boolean
  } | null
  badges: string[]
  createdTxHash: string | null
  createdTxUrl: string | null
  events: Array<{
    eventName: string
    txHash: string
    txUrl: string | null
    blockNumber: string
    logIndex: number
    createdAt: string
  }>
}

export type AssetStatus = {
  chainId: number
  chain: string | null
  assetAddress?: string
  assetType: 'lp' | 'token' | 'v3_position' | null
  isLocked: boolean
  hasPermanentLock: boolean
  totalLockedAmount: string
  lockedPercentage: string | null
  longestUnlockDate: string | null
  warnings: string[]
  badges: string[]
  contract: { address: string; isRenounced: boolean; ownerAddress: string | null } | null
  locks: ApiLock[]
}

export type SearchResult = {
  type: 'token' | 'pair' | 'lock'
  chainId: number
  address?: string
  lockId?: string
  assetAddress?: string
  name?: string | null
  symbol?: string | null
  isPermanent?: boolean
  lockedPercentage?: string | null
}

export type GlobalStats = {
  totalLocks: number
  totalActiveLocks: number
  totalPermanentLocks: number
  totalTvl: string
  totalLpTvl: string
  totalTokenTvl: string
  totalV3PositionLocks?: number
  totalV3AccruedFeesUsd?: string | null
  totalFeesCollected: string
  totalFeesCollectedUsd?: string | null
  uniqueLockers: number
  byChain: Array<{ chainId: number; name: string; totalLocks: number; totalActiveLocks: number; totalPermanentLocks: number; totalTvl: string; totalFeesCollected: string; totalFeesCollectedUsd?: string | null }>
}

export type GenesisProjectMetadata = {
  name?: string | null
  symbol?: string | null
  description?: string | null
  logo?: string | null
  banner?: string | null
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  discord?: string | null
}

async function apiGet<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`${API_BASE}${path}${separator}_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

function unwrapGenesisPayload(body: any): any {
  return body?.data?.data ?? body?.data ?? body
}

function genesisImageUrl(value: any): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  const url = value.url || value.secureUrl || value.path
  if (!url || typeof url !== 'string') return null
  if (url.startsWith('http')) return url
  return `${GENESIS_API_BASE.replace(/\/api$/, '')}${url.startsWith('/') ? url : `/${url}`}`
}

async function genesisGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${GENESIS_API_BASE}${path}`)
  if (!response.ok) return null
  return unwrapGenesisPayload(await response.json().catch(() => null)) as T | null
}

export const api = {
  chains: () => apiGet<ChainInfo[]>('/v1/chains'),
  stats: () => apiGet<GlobalStats>('/v1/stats'),
  locks: (limit = 50, filters?: { assetType?: 'token' | 'lp' | 'v3_position'; lockType?: 'timed' | 'vesting' | 'permanent'; unlockingSoon?: boolean }) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (filters?.assetType) params.set('assetType', filters.assetType)
    if (filters?.lockType) params.set('lockType', filters.lockType)
    if (filters?.unlockingSoon) params.set('unlockingSoon', 'true')
    return apiGet<{ locks: ApiLock[] }>(`/v1/locks?${params}`)
  },
  positions: (limit = 100) => apiGet<{ locks: ApiLock[] }>(`/v1/positions?limit=${limit}`),
  lock: (chainId: number, lockId: string, contractAddress?: string) => apiGet<AssetStatus>(
    contractAddress ? `/v1/locks/${chainId}/${contractAddress}/${lockId}` : `/v1/locks/${chainId}/${lockId}`
  ),
  search: (query: string) => apiGet<{ query: string; results: SearchResult[] }>(`/v1/search?q=${encodeURIComponent(query)}`),
  walletLocks: (chainId: number, address: string) => apiGet<{ chainId: number; walletAddress: string; locks: ApiLock[] }>(`/v1/wallets/${chainId}/${address}/locks`),
  myLocks: (chainId: number, address: string) => apiGet<{ chainId: number; walletAddress: string; locks: ApiLock[] }>(`/v1/my-locks/${chainId}/${address}`),
  genesisProject: async (tokenAddress: string): Promise<GenesisProjectMetadata | null> => {
    const token = await genesisGet<any>(`/token?tokenAddress=${encodeURIComponent(tokenAddress)}&include=image`).catch(() => null)
    if (!token) return null
    const image = token.image || token.logo || token.logoUrl || token.imageUrl
    return {
      name: token.name ?? token.tokenName ?? null,
      symbol: token.symbol ?? token.tokenSymbol ?? null,
      description: token.description ?? null,
      logo: genesisImageUrl(image),
      banner: genesisImageUrl(token.banner || token.bannerImage || token.coverImage),
      website: token.website ?? token.websiteUrl ?? null,
      twitter: token.twitter ?? token.x ?? token.twitterUrl ?? null,
      telegram: token.telegram ?? token.telegramUrl ?? null,
      discord: token.discord ?? token.discordUrl ?? null,
    }
  },
}

export function shortAddress(value?: string | null) {
  if (!value) return '-'
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}

export function formatUsd(value?: string | null) {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  const num = Number(value)
  if (!Number.isFinite(num)) return 'Unavailable'
  if (num === 0) return '$0'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}

export function formatDate(value?: string | null) {
  if (!value) return 'Permanent'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function formatAmount(value?: string | null, decimals = 18) {
  if (!value) return '0'
  try {
    const raw = BigInt(value)
    const divisor = 10n ** BigInt(decimals)
    const whole = raw / divisor
    const fraction = raw % divisor
    const fractionText = fraction.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '')
    return `${whole.toLocaleString()}${fractionText ? `.${fractionText}` : ''}`
  } catch {
    return value
  }
}

export function lockTypeLabel(lock: Pick<ApiLock, 'assetType'>) {
  if (lock.assetType === 'v3_position') return 'Locked Liquidity Position'
  return lock.assetType === 'lp' ? 'LP Lock' : 'Token Lock'
}

export function lockProjectName(lock: Pick<ApiLock, 'token' | 'assetAddress'>) {
  return lock.token?.name || lock.token?.symbol || shortAddress(lock.assetAddress)
}

export function lockProjectTicker(lock: Pick<ApiLock, 'token' | 'assetAddress'>) {
  return lock.token?.symbol || shortAddress(lock.assetAddress)
}

export function lockAssetLabel(lock: Pick<ApiLock, 'assetType' | 'token' | 'positionTokenId' | 'assetAddress' | 'lockId'>) {
  if (lock.assetType === 'v3_position') return `Locked Position #${lock.positionTokenId || lock.lockId || '-'}`
  return lock.token?.symbol || shortAddress(lock.assetAddress)
}

export function proofPath(lock: Pick<ApiLock, 'chainId' | 'contractAddress' | 'lockId'>) {
  return `/lock/${lock.chainId}/${lock.contractAddress}/${lock.lockId}`
}
