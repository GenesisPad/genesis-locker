import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import type { Chain } from 'viem'
import { CHAIN_CONFIGS } from './chains'

// Derive the wagmi chain tuple from CHAIN_CONFIGS.
// When a new chain is added to chains.ts it appears here automatically.
const wagmiChains = CHAIN_CONFIGS.map(c => c.wagmiChain) as [Chain, ...Chain[]]

export const wagmiConfig = getDefaultConfig({
  appName: 'Genesis Locker',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'b54d8e50b3e7e2c91a1d1c8c3a2f9e00',
  chains: wagmiChains,
  ssr: false,
})
