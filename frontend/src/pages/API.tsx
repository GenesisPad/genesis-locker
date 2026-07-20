import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Code2, Copy, ExternalLink } from 'lucide-react'

const BASE_URL = 'https://locker.genesispad.app/api/v1'

const ENDPOINTS = [
  {
    path: '/chains',
    description: 'List supported networks and the locker contracts available on each network.',
    request: 'curl https://locker.genesispad.app/api/v1/chains',
    example: `[
  {
    "id": 4663,
    "name": "Robinhood Chain",
    "symbol": "ETH",
    "feeLabel": "0.01 ETH",
    "contracts": [{ "address": "0x0372...80ed" }]
  }
]`,
  },
  {
    path: '/stats',
    description: 'Get current TVL, lock counts, permanent positions, and totals by network.',
    request: 'curl https://locker.genesispad.app/api/v1/stats',
    example: `{
  "totalLocks": 15,
  "totalPermanentLocks": 10,
  "totalTvl": "77435.62545737",
  "totalLpTvl": "35883.51009287",
  "totalTokenTvl": "41552.1153645",
  "uniqueLockers": 9,
  "byChain": []
}`,
  },
  {
    path: '/liquidity-locks?chainId=4663&limit=100',
    description: 'Integration feed for DEX listings, analytics sites, bots, and explorers. Returns active liquidity-token locks and locked V3 positions.',
    request: 'curl "https://locker.genesispad.app/api/v1/liquidity-locks?chainId=4663&limit=100"',
    example: `{
  "updatedAt": "2026-07-20T15:00:00.000Z",
  "locks": [
    {
      "chainId": 4663,
      "poolAddress": "0x7654...175b",
      "lockKind": "v3_position",
      "isLocked": true,
      "isPermanent": true,
      "lockedAmount": "38808989855914277734134",
      "lockedPercentage": null,
      "unlockDate": null,
      "valueUsd": "3407.0657033",
      "createdTxUrl": "https://robinhoodchain.blockscout.com/tx/0x..."
    }
  ]
}`,
  },
  {
    path: '/pools/:chainId/:poolAddress/locks',
    description: 'Check one liquidity pool. This works for liquidity-token pools and locked V3 positions.',
    request: 'curl https://locker.genesispad.app/api/v1/pools/4663/0x7654f462a5b3e2122c73ac02aac667dcf676175b/locks',
    example: `{
  "chainId": 4663,
  "poolAddress": "0x7654...175b",
  "isLiquidityLocked": true,
  "hasPermanentLock": true,
  "totalLockedAmount": "38808989855914277734134",
  "lockedPercentage": null,
  "totalValueUsd": "3407.0657033",
  "longestUnlockDate": null,
  "locks": []
}`,
  },
  {
    path: '/locks?limit=20',
    description: 'List recent locks. Filter by assetType, lockType, or unlockingSoon.',
    request: 'curl "https://locker.genesispad.app/api/v1/locks?limit=20&assetType=token"',
    example: `{
  "locks": [
    {
      "lockId": "2",
      "chainId": 4663,
      "assetType": "token",
      "lockType": "vesting",
      "remainingLockedAmount": "350000000000000000000000000",
      "unlockDate": "2026-09-06T23:00:00.000Z",
      "tvlUsd": "26227.5888"
    }
  ]
}`,
  },
  {
    path: '/positions?limit=20',
    description: 'List permanently locked Genesis launch liquidity positions.',
    request: 'curl "https://locker.genesispad.app/api/v1/positions?limit=20"',
    example: `{
  "locks": [
    {
      "assetType": "v3_position",
      "positionTokenId": "197104",
      "isPermanent": true,
      "poolAddress": "0x7654...175b",
      "tvlUsd": "3407.0657033"
    }
  ]
}`,
  },
  {
    path: '/locks/:chainId/:lockId',
    description: 'Get one lock and its asset summary. Include the contract address when lock numbers overlap.',
    request: 'curl https://locker.genesispad.app/api/v1/locks/4663/2',
    example: `{
  "chainId": 4663,
  "chain": "Robinhood Chain",
  "isLocked": true,
  "hasPermanentLock": false,
  "totalLockedAmount": "350000000000000000000000000",
  "lockedPercentage": "35",
  "locks": []
}`,
  },
  {
    path: '/check/:chainId/:assetAddress',
    description: 'Check whether a token or liquidity-token address has active locks.',
    request: 'curl https://locker.genesispad.app/api/v1/check/4663/0xb84622564b131ce0950ebb35713801619bfddc9c',
    example: `{
  "chainId": 4663,
  "assetType": "token",
  "isLocked": true,
  "hasPermanentLock": false,
  "lockedPercentage": "44.5",
  "warnings": [],
  "badges": ["Token Locked"]
}`,
  },
  {
    path: '/wallets/:chainId/:walletAddress/locks',
    description: 'List locks owned by, or payable to, a wallet on one network.',
    request: 'curl https://locker.genesispad.app/api/v1/wallets/4663/0x8cfa84924011b19765136baea669ac81fe8bb561/locks',
    example: `{
  "chainId": 4663,
  "walletAddress": "0x8cfa...b561",
  "locks": []
}`,
  },
  {
    path: '/search?q=:query',
    description: 'Search by token address, wallet, pool, position number, or lock number.',
    request: 'curl "https://locker.genesispad.app/api/v1/search?q=GEN"',
    example: `{
  "query": "GEN",
  "results": [
    { "type": "token", "chainId": 4663, "name": "GenesisPad", "symbol": "GEN" }
  ]
}`,
  },
]

export function APIPage() {
  const [copied, setCopied] = useState('')

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key)
      window.setTimeout(() => setCopied(current => current === key ? '' : current), 1500)
    }).catch(() => {})
  }

  return (
    <div className="api-page">
      <motion.div className="page-heading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="page-title-row">
          <Code2 size={22} color="var(--accent)" />
          <h1 className="page-title">Genesis Locker API</h1>
        </div>
        <p className="page-desc">Public lock and TVL data for websites, bots, dashboards, and community tools.</p>
      </motion.div>

      <section className="api-intro">
        <div>
          <span>Base URL</span>
          <code>{BASE_URL}</code>
        </div>
        <button type="button" className="btn-secondary" onClick={() => copy(BASE_URL, 'base')}>
          {copied === 'base' ? <Check size={13} /> : <Copy size={13} />}
          {copied === 'base' ? 'Copied' : 'Copy base URL'}
        </button>
      </section>

      <div className="api-facts">
        <p><strong>Public API:</strong> general lock and TVL endpoints are public and read-only. Partner routes require an API key.</p>
        <p><strong>Partner keys:</strong> issue keys from Genesis Sentinel, then use the same raw value for Locker partner access.</p>
        <p><strong>Numbers:</strong> token amounts and USD values are returned as strings to preserve precision.</p>
        <p><strong>Freshness:</strong> prices and TVL refresh every five minutes. New transactions normally appear within a few minutes.</p>
      </div>

      <div className="api-list">
        {ENDPOINTS.map((endpoint, index) => (
          <motion.section key={endpoint.path} className="api-endpoint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.035 }}>
            <header className="api-endpoint-header">
              <span className="http-method get">GET</span>
              <code className="api-path">{endpoint.path}</code>
              <button type="button" className="api-copy" onClick={() => copy(endpoint.request, endpoint.path)}>
                {copied === endpoint.path ? <Check size={12} /> : <Copy size={12} />}
                {copied === endpoint.path ? 'Copied' : 'Copy request'}
              </button>
            </header>
            <p className="api-desc">{endpoint.description}</p>
            <div className="api-example-label">Request</div>
            <pre className="api-code-block request"><code>{endpoint.request}</code></pre>
            <div className="api-example-label">Example response</div>
            <pre className="api-code-block"><code>{endpoint.example}</code></pre>
          </motion.section>
        ))}
      </div>

      <a className="api-open-link" href={`${BASE_URL}/stats`} target="_blank" rel="noreferrer">
        Open the live stats response <ExternalLink size={13} />
      </a>
    </div>
  )
}
