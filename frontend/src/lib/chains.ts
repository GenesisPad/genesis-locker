/**
 * chains.ts — single source of truth for chain configuration.
 *
 * To add a new chain:
 *   1. Add an entry to CHAIN_CONFIGS below (one object, five fields).
 *   2. Add a DB row via the API config.ts + run prisma migrate.
 *   3. Deploy the locker contract on the new chain.
 *
 * Everything else in the frontend (CreateLock, ProjectDetail, wagmi setup)
 * derives from this file and from the API response — no other files need
 * editing.
 */

import { mainnet, base, bsc, hardhat } from 'viem/chains'
import type { Chain } from 'viem'
import type { ChainInfo } from './api'

// ── Static chain registry ──────────────────────────────────────────────────

export type ChainConfig = {
  id: number
  name: string
  symbol: string
  /** Brand hex color for the chain dot indicator. */
  dotColor: string
  /** Human-readable fee label shown in UI, e.g. "0.01 ETH". */
  feeLabel: string
  /** GeckoTerminal network slug for the chart embed, or null if unsupported. */
  geckoTerminalId: string | null
  /** Block explorer base URL. */
  explorerUrl: string
  /** Viem/wagmi chain object for wallet switching. */
  wagmiChain: Chain
}

export const CHAIN_CONFIGS: ChainConfig[] = [
  {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    dotColor: '#627EEA',
    feeLabel: '0.01 ETH',
    geckoTerminalId: 'eth',
    explorerUrl: 'https://etherscan.io',
    wagmiChain: mainnet,
  },
  {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    dotColor: '#0052FF',
    feeLabel: '0.01 ETH',
    geckoTerminalId: 'base',
    explorerUrl: 'https://basescan.org',
    wagmiChain: base,
  },
  {
    id: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    dotColor: '#F3BA2F',
    feeLabel: '0.03 BNB',
    geckoTerminalId: 'bsc',
    explorerUrl: 'https://bscscan.com',
    wagmiChain: bsc,
  },
  // Local dev chain — only included when running Vite in dev mode.
  ...(import.meta.env.DEV
    ? [{
        id: 31337,
        name: 'Local Hardhat',
        symbol: 'ETH',
        dotColor: '#22c55e',
        feeLabel: '0.01 ETH',
        geckoTerminalId: null,
        explorerUrl: 'http://localhost:8545',
        wagmiChain: hardhat,
      } satisfies ChainConfig]
    : []),
]

// ── Lookup helpers ─────────────────────────────────────────────────────────

export function getChainById(id: number): ChainConfig | undefined {
  return CHAIN_CONFIGS.find(c => c.id === id)
}

/**
 * Fuzzy name lookup — handles the various casing/naming conventions used
 * across the codebase (API "BSC" vs UI "BNB Chain", mock data "ETH" vs
 * "Ethereum", etc.).
 */
const NAME_ALIASES: Record<string, number> = {
  eth: 1, ethereum: 1,
  base: 8453,
  bnb: 56, bsc: 56, 'bnb chain': 56,
  hardhat: 31337, localhost: 31337, 'local hardhat': 31337,
}

export function getChainByName(name: string): ChainConfig | undefined {
  const key = name.toLowerCase()
  const byAlias = NAME_ALIASES[key]
  if (byAlias !== undefined) return getChainById(byAlias)
  return CHAIN_CONFIGS.find(c => c.name.toLowerCase() === key)
}

/**
 * Merge static CHAIN_CONFIGS with live API data.
 * The API is authoritative for fee amounts and contract addresses.
 * CHAIN_CONFIGS is the fallback when the API hasn't loaded yet.
 */
export function mergeWithApiChains(apiChains: ChainInfo[]): (ChainConfig & {
  feeLabel: string
  contractAddress?: string
  isRenounced?: boolean
  creationFee?: string | null
})[] {
  // Build a set of chain IDs returned by the API so we can filter CHAIN_CONFIGS.
  const apiIds = new Set(apiChains.map(c => c.id))

  return CHAIN_CONFIGS
    .filter(c => apiIds.has(c.id) || import.meta.env.DEV)
    .map(cfg => {
      const api = apiChains.find(c => c.id === cfg.id)
      return {
        ...cfg,
        // API overrides for display fields (allows runtime fee updates without a deploy)
        dotColor: api?.dotColor ?? cfg.dotColor,
        geckoTerminalId: api?.geckoTerminalId ?? cfg.geckoTerminalId,
        feeLabel: api?.feeLabel ?? cfg.feeLabel,
        explorerUrl: api?.explorerUrl ?? cfg.explorerUrl,
        // Contract data from API
        contractAddress: api?.contracts?.[0]?.address,
        isRenounced: api?.contracts?.[0]?.isRenounced,
        creationFee: api?.contracts?.[0]?.creationFee,
      }
    })
}
