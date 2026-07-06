import React from 'react'
import { motion } from 'framer-motion'
import { Code2, Copy } from 'lucide-react'

const ENDPOINTS = [
  {
    method: 'GET' as const,
    path: '/v1/lock/:lockId',
    desc: 'Get lock details by ID',
    example: `{
  "id": 1,
  "type": "lp",
  "chain": "ethereum",
  "asset": "0xBB2b8038a1640196FbE3e38816F3e67Cba72D940",
  "amount": "1250.45",
  "lockedUntil": "2026-12-31T00:00:00Z",
  "lockPct": 78.45,
  "status": "active",
  "permanent": false
}`,
  },
  {
    method: 'GET' as const,
    path: '/v1/check/:chainId/:assetAddress',
    desc: 'Check lock status for a token or LP pair',
    example: `{
  "address": "0xBB2b8038a1640196FbE3e38816F3e67Cba72D940",
  "chain": "ethereum",
  "isLocked": true,
  "totalLocked": "$2,842,450",
  "lockPct": 78.45,
  "activeLocks": 2,
  "permanentLocks": 0,
  "badges": ["LP_LOCKED", "HIGH_LOCK_PCT"]
}`,
  },
  {
    method: 'GET' as const,
    path: '/v1/locks?chain=ethereum&type=lp&page=1',
    desc: 'List locks with optional filters',
    example: `{
  "total": 8241,
  "page": 1,
  "pageSize": 20,
  "data": [...]
}`,
  },
  {
    method: 'GET' as const,
    path: '/v1/search?q=:query',
    desc: 'Search tokens, LP pairs, wallets, or lock IDs',
    example: `{
  "results": [
    { "type": "lp", "name": "UNI/WETH", "chain": "ethereum", "tvl": "$2.8M" }
  ]
}`,
  },
  {
    method: 'GET' as const,
    path: '/v1/stats',
    desc: 'Protocol-wide statistics and TVL',
    example: `{
  "totalTvl": "$128,746,532",
  "totalLocks": 18742,
  "lpLocks": 12450,
  "tokenLocks": 6292,
  "permanentLocks": 4291,
  "feesCollected": "12.842 ETH"
}`,
  },
]

export function APIPage() {
  return (
    <div className="api-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Code2 size={22} color="var(--purple)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Public API</h1>
        </div>
        <p className="page-desc">
          Genesis Locker provides a free, public REST API for integrating lock data into your dApp, dashboard, or tools.
        </p>
      </motion.div>

      <div style={{
        padding: '12px 16px', background: 'rgba(217, 173, 74,0.06)',
        border: '1px solid rgba(217, 173, 74,0.15)', borderRadius: 'var(--r)',
        marginBottom: 24, fontFamily: 'monospace', fontSize: 13,
      }}>
        Base URL: <span style={{ color: 'var(--purple)' }}>https://api.genesispad.app</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ENDPOINTS.map((ep, i) => (
          <motion.div
            key={ep.path}
            className="api-endpoint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <div className="api-endpoint-header">
              <span className={`http-method ${ep.method.toLowerCase()}`}>{ep.method}</span>
              <span className="api-path">{ep.path}</span>
              <span className="api-desc">{ep.desc}</span>
              <button
                style={{ marginLeft: 'auto', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                onClick={() => navigator.clipboard.writeText(`https://api.genesispad.app${ep.path}`).catch(() => {})}
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <div className="api-code-block">
              {ep.example}
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{
        marginTop: 24, padding: '16px 20px',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Authentication</div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          The Public API is free and requires no authentication for read operations.
          Rate limits: 100 requests/minute per IP. For higher limits, contact us.
        </p>
      </div>
    </div>
  )
}
