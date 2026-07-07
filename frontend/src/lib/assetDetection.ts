import { createPublicClient, http, isAddress, formatUnits, type Address } from 'viem'
import type { ChainConfig } from './chains'

const erc20Abi = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const pairAbi = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }],
  },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export interface DetectedToken {
  address: string
  name: string
  symbol: string
  decimals: number
}

export interface DetectedPair {
  address: string
  token0: DetectedToken
  token1: DetectedToken
  reserve0: string
  reserve1: string
}

export interface DetectedAsset {
  inputAddress: string
  /** Present when the address is (or resolves to) a plain ERC20 token. */
  token: DetectedToken | null
  /** Present when the address is a Uniswap V2-style LP pair. */
  pair: DetectedPair | null
}

/**
 * Detect what an address actually is on-chain: an ERC20 token, a Uniswap
 * V2-style LP pair, or neither. This performs real RPC reads against the
 * selected chain — it never fabricates data. Returns null if the address
 * doesn't resolve to a contract implementing either interface on this chain.
 */
export async function detectAssetOnChain(address: string, chain: ChainConfig): Promise<DetectedAsset | null> {
  if (!isAddress(address)) return null

  const client = createPublicClient({ chain: chain.wagmiChain, transport: http() })
  const addr = address as Address

  // Try LP pair first: token0/token1/getReserves is unambiguous when it succeeds.
  try {
    const [token0Addr, token1Addr, reserves] = await Promise.all([
      client.readContract({ address: addr, abi: pairAbi, functionName: 'token0' }),
      client.readContract({ address: addr, abi: pairAbi, functionName: 'token1' }),
      client.readContract({ address: addr, abi: pairAbi, functionName: 'getReserves' }),
    ])

    const [token0, token1] = await Promise.all([
      readToken(client, token0Addr),
      readToken(client, token1Addr),
    ])

    if (token0 && token1) {
      return {
        inputAddress: address,
        token: null,
        pair: {
          address,
          token0,
          token1,
          reserve0: formatUnits(reserves[0], token0.decimals),
          reserve1: formatUnits(reserves[1], token1.decimals),
        },
      }
    }
  } catch {
    // Not a pair — fall through to plain-token detection.
  }

  // Try plain ERC20 token.
  const token = await readToken(client, addr)
  if (token) {
    return { inputAddress: address, token, pair: null }
  }

  return null
}

async function readToken(client: ReturnType<typeof createPublicClient>, address: Address): Promise<DetectedToken | null> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
    ])
    return { address, name: String(name), symbol: String(symbol), decimals: Number(decimals) }
  } catch {
    return null
  }
}
