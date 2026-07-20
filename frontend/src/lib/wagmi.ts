import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { http } from 'wagmi'
import type { Chain } from 'viem'
import { CHAIN_CONFIGS } from './chains'

// Derive the wagmi chain tuple from CHAIN_CONFIGS.
// When a new chain is added to chains.ts it appears here automatically.
const wagmiChains = CHAIN_CONFIGS.map(c => c.wagmiChain) as [Chain, ...Chain[]]
const transports = Object.fromEntries(
  CHAIN_CONFIGS.map(chain => [chain.id, http(chain.wagmiChain.rpcUrls.default.http[0], { batch: true })]),
)

export const wagmiConfig = getDefaultConfig({
  appName: 'Genesis Locker',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd0f8a0df8b52c9cd980a7295ec15dfc2',
  chains: wagmiChains,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [injectedWallet, metaMaskWallet, rainbowWallet, trustWallet, coinbaseWallet],
    },
    {
      groupName: 'More wallets',
      wallets: [walletConnectWallet],
    },
  ],
  transports,
  ssr: false,
})
