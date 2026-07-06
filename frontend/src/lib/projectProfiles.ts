export interface ProjectProfile {
  address: string
  lpAddress?: string
  name: string
  symbol: string
  chain: 'ETH' | 'BNB' | 'Base'
  logo: string
  banner: string
  website: string
  twitter: string
  telegram: string
  discord: string
  description: string
  trustScore: number
  tvlLocked: number
  lockPct: number
  isPermanent: boolean
  isRenounced: boolean
  isAudited: boolean
  noMint: boolean
  activeLocks: number
  category: string
}

export interface DetectedToken {
  address: string
  name: string
  symbol: string
  chain: string
  decimals: number
  priceUsd: number
  marketCapUsd: number
  hasLP: boolean
  lpAddress: string
}

export interface DetectedLP {
  address: string
  token0Symbol: string
  token1Symbol: string
  token0Address: string
  dex: string
  chain: string
  tvlUsd: number
}

export interface DetectedAsset {
  inputAddress: string
  token: DetectedToken
  lp: DetectedLP | null
  profile: ProjectProfile | null
}

export const MOCK_PROFILES: ProjectProfile[] = [
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    lpAddress: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5',
    name: 'HoldToken',
    symbol: 'HOLD',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'holdtoken.io',
    twitter: '@HoldTokenFi',
    telegram: 't.me/holdtokenfi',
    discord: 'discord.gg/holdtoken',
    description: 'HoldToken is a community-governed token with 94% of supply permanently locked on-chain. The benchmark for trustworthy launches.',
    trustScore: 95,
    tvlLocked: 22100000,
    lockPct: 94,
    isPermanent: true,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 3,
    category: 'DeFi',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    lpAddress: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Cd9d',
    name: 'Uniswap',
    symbol: 'UNI',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'uniswap.org',
    twitter: '@Uniswap',
    telegram: '',
    discord: 'discord.gg/uniswap',
    description: 'The leading decentralized protocol for automated liquidity provision on Ethereum.',
    trustScore: 94,
    tvlLocked: 18500000,
    lockPct: 72,
    isPermanent: false,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 12,
    category: 'DeFi',
  },
  {
    address: '0xD33526068D116cE69F19A9ee46F0bd304F21A51f',
    lpAddress: '0x6faff56a5ccea8b5e0f6693f36fce1c53d2c5e15',
    name: 'Rocket Pool',
    symbol: 'RPL',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'rocketpool.net',
    twitter: '@Rocket_Pool',
    telegram: '',
    discord: 'discord.gg/rocketpool',
    description: 'Rocket Pool is a decentralized Ethereum staking protocol. 88% of token supply is permanently locked to align long-term incentives.',
    trustScore: 91,
    tvlLocked: 14300000,
    lockPct: 88,
    isPermanent: true,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 5,
    category: 'Infrastructure',
  },
  {
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    lpAddress: '0x0eD7e52944161450477ee417DE9Cd3a859b14fD0',
    name: 'PancakeSwap',
    symbol: 'CAKE',
    chain: 'BNB',
    logo: '',
    banner: '',
    website: 'pancakeswap.finance',
    twitter: '@PancakeSwap',
    telegram: 't.me/PancakeSwap',
    discord: 'discord.gg/pancakeswap',
    description: 'The most popular decentralized exchange on BNB Chain with automated market making.',
    trustScore: 89,
    tvlLocked: 12100000,
    lockPct: 68,
    isPermanent: false,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 8,
    category: 'DeFi',
  },
  {
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    lpAddress: '0x7f5C649856F900d15C83741f45AE46f5C6858234',
    name: 'Aerodrome',
    symbol: 'AERO',
    chain: 'Base',
    logo: '',
    banner: '',
    website: 'aerodrome.finance',
    twitter: '@AerodromeDefi',
    telegram: '',
    discord: 'discord.gg/aerodrome',
    description: "Base's leading DEX and liquidity marketplace, with 85% of circulating supply locked in protocol-owned liquidity.",
    trustScore: 87,
    tvlLocked: 8400000,
    lockPct: 85,
    isPermanent: false,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 6,
    category: 'DeFi',
  },
  {
    address: '0x3C4B6E6BF0BBa0f34700b76D5B7C07b3C57C87D2',
    lpAddress: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
    name: 'TokenFi',
    symbol: 'TOKEN',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'tokenfi.com',
    twitter: '@TokenFi',
    telegram: 't.me/tokenfi',
    discord: '',
    description: 'TokenFi is the all-in-one token creation and management platform. 79% of supply locked via Genesis Locker.',
    trustScore: 88,
    tvlLocked: 6200000,
    lockPct: 79,
    isPermanent: false,
    isRenounced: true,
    isAudited: true,
    noMint: true,
    activeLocks: 4,
    category: 'Infrastructure',
  },
  {
    address: '0x7b2F9706CD8473B74F913F54eB9f1EcDEf9AE9b5',
    lpAddress: '0x2c7d5cC100B1f4A5cA76D7A7e61C1dA8c0b2f813',
    name: 'NexProtocol',
    symbol: 'NEX',
    chain: 'Base',
    logo: '',
    banner: '',
    website: 'nexprotocol.io',
    twitter: '@NexProtocol',
    telegram: 't.me/nexprotocol',
    discord: 'discord.gg/nex',
    description: 'NexProtocol brings institutional-grade yield strategies to Base. 77% of supply locked for 24 months.',
    trustScore: 86,
    tvlLocked: 2200000,
    lockPct: 77,
    isPermanent: false,
    isRenounced: true,
    isAudited: false,
    noMint: true,
    activeLocks: 2,
    category: 'Yield',
  },
  {
    address: '0x9C2C5fd7b07E95EE044DDeba0E97a665F142394f',
    lpAddress: '0x6D57A53A45343187905aaD6AD8eD532D105697C0',
    name: 'BaseSwap',
    symbol: 'BSX',
    chain: 'Base',
    logo: '',
    banner: '',
    website: 'baseswap.fi',
    twitter: '@BaseSwap_Fi',
    telegram: 't.me/BaseSwap',
    discord: 'discord.gg/baseswap',
    description: 'BaseSwap is the premier DEX on Base. Liquidity is permanently locked, providing long-term stability for traders.',
    trustScore: 83,
    tvlLocked: 3700000,
    lockPct: 71,
    isPermanent: true,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 7,
    category: 'DeFi',
  },
  {
    address: '0xC2f3a0dC2bf3AeC2Ce3E5bCE9fD38eC4A8dF821f',
    lpAddress: '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16',
    name: 'CryptoFarm',
    symbol: 'FARM',
    chain: 'BNB',
    logo: '',
    banner: '',
    website: 'cryptofarm.io',
    twitter: '@CryptoFarmBNB',
    telegram: 't.me/cryptofarm',
    discord: '',
    description: 'CryptoFarm is a yield farming protocol on BNB Chain with 74% of its supply locked for 18 months.',
    trustScore: 82,
    tvlLocked: 3300000,
    lockPct: 74,
    isPermanent: false,
    isRenounced: true,
    isAudited: false,
    noMint: true,
    activeLocks: 3,
    category: 'Yield',
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    lpAddress: '0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f',
    name: 'VaultX',
    symbol: 'VLTX',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'vaultx.finance',
    twitter: '@VaultXFi',
    telegram: 't.me/vaultxfi',
    discord: 'discord.gg/vaultx',
    description: 'VaultX is a multi-chain asset management protocol. 65% of supply locked for investor confidence.',
    trustScore: 78,
    tvlLocked: 4800000,
    lockPct: 65,
    isPermanent: false,
    isRenounced: true,
    isAudited: false,
    noMint: false,
    activeLocks: 5,
    category: 'DeFi',
  },
  {
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    lpAddress: '0x811beed0119b4afce20d2583eb608c6f7af1954f',
    name: 'Shiba Inu',
    symbol: 'SHIB',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: 'shibatoken.com',
    twitter: '@Shibtoken',
    telegram: 't.me/shibainutoken',
    discord: '',
    description: 'Shiba Inu is the self-proclaimed Dogecoin Killer. 45% of circulating supply locked, showcasing long-term vision.',
    trustScore: 76,
    tvlLocked: 4200000,
    lockPct: 45,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 6,
    category: 'Meme',
  },
  {
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    lpAddress: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
    name: 'Pepe',
    symbol: 'PEPE',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: '',
    twitter: '@pepecoineth',
    telegram: 't.me/pepecoineth',
    discord: '',
    description: "The most memeable memecoin in existence. 61% of supply locked via Genesis Locker to demonstrate commitment.",
    trustScore: 73,
    tvlLocked: 5100000,
    lockPct: 61,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 4,
    category: 'Meme',
  },
  {
    address: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E',
    lpAddress: '0x1e869e5f1fc3a8d7dd7d3baf2c9f24bF9c51050B',
    name: 'Brett',
    symbol: 'BRETT',
    chain: 'Base',
    logo: '',
    banner: '',
    website: '',
    twitter: '@basedbrett',
    telegram: 't.me/BRETT_base',
    discord: '',
    description: "Brett is Based. The largest meme coin on Base with a growing community and 57% of supply locked.",
    trustScore: 69,
    tvlLocked: 1900000,
    lockPct: 57,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 2,
    category: 'Meme',
  },
  {
    address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    lpAddress: '0xae54E7723CAD15b6Bf618AF1DA0e25f0Dc0baB80',
    name: 'MoonBase',
    symbol: 'MNBS',
    chain: 'Base',
    logo: '',
    banner: '',
    website: 'moonbase.io',
    twitter: '@MoonBaseBase',
    telegram: '',
    discord: '',
    description: 'MoonBase is a new DeFi project on Base with 57% locked supply and plans for protocol-owned liquidity.',
    trustScore: 69,
    tvlLocked: 1900000,
    lockPct: 57,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 1,
    category: 'DeFi',
  },
  {
    address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
    lpAddress: '0x4f614bb9cAcA6Ea7c7F70b4E5Ad9c80aB0Fe6A19',
    name: 'FLOKI',
    symbol: 'FLOKI',
    chain: 'BNB',
    logo: '',
    banner: '',
    website: 'floki.com',
    twitter: '@RealFlokiInu',
    telegram: 't.me/FlokiInuToken',
    discord: 'discord.gg/floki',
    description: 'FLOKI is a community-powered ecosystem with a focus on utility through NFTs, DeFi, and education.',
    trustScore: 68,
    tvlLocked: 2800000,
    lockPct: 52,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: true,
    activeLocks: 3,
    category: 'Meme',
  },
  {
    address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe',
    lpAddress: '0xCDAA0BB25B3B5dEF35BD96CAd83ECd8Ce5E06Af6',
    name: 'SafeMoon V2',
    symbol: 'SFM',
    chain: 'BNB',
    logo: '',
    banner: '',
    website: 'safemoon.com',
    twitter: '@SafeMoon',
    telegram: 't.me/SafeMoon',
    discord: '',
    description: 'SafeMoon V2 is a deflationary protocol with automatic liquidity generation and burn mechanisms.',
    trustScore: 61,
    tvlLocked: 1100000,
    lockPct: 38,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: false,
    activeLocks: 2,
    category: 'Meme',
  },
  {
    address: '0xbdD4Bda0EeA4F7bA21cf7BCEE2c68D8f5a0CfBa5',
    lpAddress: '0x8d3A1C5Bc2b3c72f9CD8a3FA11B81b56C99E5C05',
    name: 'DegenDex',
    symbol: 'DGDX',
    chain: 'BNB',
    logo: '',
    banner: '',
    website: '',
    twitter: '@DegenDexBNB',
    telegram: 't.me/DegenDex',
    discord: '',
    description: 'DegenDex is a high-risk, high-reward DEX on BNB Chain. Active mint function.',
    trustScore: 55,
    tvlLocked: 600000,
    lockPct: 33,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: false,
    activeLocks: 1,
    category: 'DeFi',
  },
  {
    address: '0x576e2BeD8F7b46D34016198911Cdf9886f78bea7',
    lpAddress: '0x9B1a6e79B03b40F4C3Fc4b5E57d1A1A9a0a1a222',
    name: 'TurboMeme',
    symbol: 'TURBO',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: '',
    twitter: '@TurboMemeETH',
    telegram: '',
    discord: '',
    description: 'TurboMeme is a community meme token on Ethereum. Low lock percentage currently.',
    trustScore: 48,
    tvlLocked: 400000,
    lockPct: 28,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: false,
    activeLocks: 1,
    category: 'Meme',
  },
  {
    address: '0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D',
    lpAddress: '0xA6aE9Fcc87bB2A5cD134f1F3DacC64dBF7F7b2e1',
    name: 'MAGA',
    symbol: 'TRUMP',
    chain: 'ETH',
    logo: '',
    banner: '',
    website: '',
    twitter: '@MAGAcoin',
    telegram: '',
    discord: '',
    description: 'MAGA is a political meme token with very low lock percentage.',
    trustScore: 35,
    tvlLocked: 800000,
    lockPct: 15,
    isPermanent: false,
    isRenounced: false,
    isAudited: false,
    noMint: false,
    activeLocks: 1,
    category: 'Meme',
  },
]

// --- Detection logic ---

function hashAddr(addr: string): number {
  let h = 5381
  for (let i = 2; i < addr.length; i++) {
    const c = parseInt(addr[i], 16)
    h = ((h << 5) + h + c) & 0x7fffffff
  }
  return Math.abs(h)
}

const FALLBACK_TOKENS = [
  { name: 'AlphaBase', symbol: 'ALPHA', chain: 'Base' },
  { name: 'BetaFi', symbol: 'BETA', chain: 'ETH' },
  { name: 'GammaDex', symbol: 'GAMMA', chain: 'BNB' },
  { name: 'DeltaSwap', symbol: 'DLTA', chain: 'ETH' },
  { name: 'EpsilonX', symbol: 'EPLX', chain: 'Base' },
  { name: 'ZetaVault', symbol: 'ZETA', chain: 'BNB' },
  { name: 'ThetaYield', symbol: 'THET', chain: 'ETH' },
  { name: 'IotaLock', symbol: 'IOTA', chain: 'Base' },
  { name: 'KappaSwap', symbol: 'KAPP', chain: 'BNB' },
  { name: 'LambdaFi', symbol: 'LMBD', chain: 'ETH' },
]

const FALLBACK_DEXES = [
  'Uniswap V2',
  'Uniswap V3',
  'SushiSwap',
  'PancakeSwap V2',
  'BaseSwap',
  'Aerodrome',
]

const PAIR_TOKENS = ['WETH', 'USDC', 'USDT', 'BNB', 'WBTC']

export function detectAsset(address: string): DetectedAsset | null {
  if (!address || address.length < 42) return null

  const lower = address.toLowerCase()

  // Check known profiles: token address
  for (const profile of MOCK_PROFILES) {
    if (profile.address.toLowerCase() === lower) {
      const dex = profile.chain === 'BNB' ? 'PancakeSwap V2' : profile.chain === 'Base' ? 'Aerodrome' : 'Uniswap V2'
      const pair1 = profile.chain === 'BNB' ? 'BNB' : 'WETH'
      return {
        inputAddress: address,
        token: {
          address: profile.address,
          name: profile.name,
          symbol: profile.symbol,
          chain: profile.chain,
          decimals: 18,
          priceUsd: (profile.tvlLocked / 1e9) * 0.05,
          marketCapUsd: profile.tvlLocked * 2.8,
          hasLP: !!profile.lpAddress,
          lpAddress: profile.lpAddress || '',
        },
        lp: profile.lpAddress
          ? {
              address: profile.lpAddress,
              token0Symbol: profile.symbol,
              token1Symbol: pair1,
              token0Address: profile.address,
              dex,
              chain: profile.chain,
              tvlUsd: profile.tvlLocked * 0.4,
            }
          : null,
        profile,
      }
    }
  }

  // Check known profiles: LP address
  for (const profile of MOCK_PROFILES) {
    if (profile.lpAddress && profile.lpAddress.toLowerCase() === lower) {
      const dex = profile.chain === 'BNB' ? 'PancakeSwap V2' : profile.chain === 'Base' ? 'Aerodrome' : 'Uniswap V2'
      const pair1 = profile.chain === 'BNB' ? 'BNB' : 'WETH'
      return {
        inputAddress: address,
        token: {
          address: profile.address,
          name: profile.name,
          symbol: profile.symbol,
          chain: profile.chain,
          decimals: 18,
          priceUsd: (profile.tvlLocked / 1e9) * 0.05,
          marketCapUsd: profile.tvlLocked * 2.8,
          hasLP: true,
          lpAddress: profile.lpAddress,
        },
        lp: {
          address: profile.lpAddress,
          token0Symbol: profile.symbol,
          token1Symbol: pair1,
          token0Address: profile.address,
          dex,
          chain: profile.chain,
          tvlUsd: profile.tvlLocked * 0.4,
        },
        profile,
      }
    }
  }

  // Fallback: derive deterministically from address
  const h = hashAddr(address)
  const t = FALLBACK_TOKENS[h % FALLBACK_TOKENS.length]
  const hasLP = (h % 5) !== 0 // 80% have LP
  const dex = FALLBACK_DEXES[(h >> 3) % FALLBACK_DEXES.length]
  const pair1 = PAIR_TOKENS[(h >> 6) % PAIR_TOKENS.length]
  const lpAddress = hasLP ? `0x${address.slice(2, 22)}a1b2c3d4e5${address.slice(-8)}` : ''
  const priceUsd = ((h % 9999) + 1) / 10000000
  const marketCapUsd = priceUsd * ((h % 900) + 100) * 1e6
  const tvlUsd = marketCapUsd * 0.12

  return {
    inputAddress: address,
    token: {
      address,
      name: t.name,
      symbol: t.symbol,
      chain: t.chain,
      decimals: 18,
      priceUsd,
      marketCapUsd,
      hasLP,
      lpAddress,
    },
    lp: hasLP
      ? {
          address: lpAddress,
          token0Symbol: t.symbol,
          token1Symbol: pair1,
          token0Address: address,
          dex,
          chain: t.chain,
          tvlUsd,
        }
      : null,
    profile: null,
  }
}

export function getProfileByAddress(address: string): ProjectProfile | undefined {
  const lower = address.toLowerCase()
  return MOCK_PROFILES.find(
    p => p.address.toLowerCase() === lower || p.lpAddress?.toLowerCase() === lower
  )
}
