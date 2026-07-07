import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { formatEther } from 'viem'
import { api, ChainInfo, formatUsd } from '../lib/api'

function formatCreationFee(chain: ChainInfo, fallback: string): string {
  const raw = chain.contracts?.[0]?.creationFee
  if (!raw) return fallback
  try {
    return `${formatEther(BigInt(raw))} ${chain.symbol}`
  } catch {
    return fallback
  }
}

const CHAIN_STYLE: Record<number, { tag: string; color: string; bg: string; desc: string; fee: string }> = {
  4663: { tag: 'RH', color: '#d9ad4a', bg: '#201a08', desc: "Genesis Locker's primary chain — Robinhood Chain, home of the GenesisPad ecosystem.", fee: '0.01 ETH' },
  1: { tag: 'ETH', color: '#627EEA', bg: '#0d1240', desc: 'The original smart contract platform. Maximum security and decentralization.', fee: '0.01 ETH' },
  8453: { tag: 'BASE', color: '#0052FF', bg: '#000d24', desc: 'Coinbase L2 built on the OP Stack. Low fees, Ethereum security.', fee: '0.01 ETH' },
  56: { tag: 'BNB', color: '#F3BA2F', bg: '#1a1300', desc: 'High-throughput EVM chain with low fees and large DeFi ecosystem.', fee: '0.03 BNB' },
}

export function Chains() {
  const [chains, setChains] = useState<ChainInfo[]>([])
  const [stats, setStats] = useState<Record<number, { totalLocks: number; totalTvl: string }>>({})

  useEffect(() => {
    api.chains().then(setChains).catch(() => setChains([]))
    api.stats().then(data => setStats(Object.fromEntries(data.byChain.map(row => [row.chainId, row])))).catch(() => setStats({}))
  }, [])

  return (
    <div className="chains-page">
      <motion.div className="page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="page-title">Supported Chains</h1>
        <p className="page-desc">Genesis Locker operates across four EVM-compatible chains with unified contract standards, led by Robinhood Chain.</p>
      </motion.div>

      <div className="chains-grid">
        {chains.map((chain, i) => {
          const style = CHAIN_STYLE[chain.id] || CHAIN_STYLE[1]
          const chainStats = stats[chain.id]
          const contract = chain.contracts?.[0]
          return (
            <motion.div key={chain.id} className="chain-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
              <div className="chain-card-icon" style={{ background: style.bg, border: `1px solid ${style.color}30` }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: style.color }}>{style.tag}</span>
              </div>
              <div className="chain-card-name">{chain.name}</div>
              <div className="chain-card-sub">{style.desc}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: contract?.address ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 10.5, fontWeight: 700, color: contract?.address ? 'var(--success)' : 'var(--warning)', marginBottom: 14 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: contract?.address ? 'var(--success)' : 'var(--warning)' }} />
                {contract?.address ? 'Configured' : 'Awaiting Deployment'}
              </div>
              <div className="chain-stat-row"><span className="chain-stat-label">Total Locks</span><span className="chain-stat-val">{chainStats?.totalLocks ?? 0}</span></div>
              <div className="chain-stat-row"><span className="chain-stat-label">TVL</span><span className="chain-stat-val">{formatUsd(chainStats?.totalTvl)}</span></div>
              <div className="chain-stat-row"><span className="chain-stat-label">Platform Fee</span><span className="chain-stat-val">{formatCreationFee(chain, style.fee)}</span></div>
              <div className="chain-stat-row"><span className="chain-stat-label">Ownership</span><span className="chain-stat-val">{contract?.isRenounced ? 'Renounced' : 'Not Renounced'}</span></div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
