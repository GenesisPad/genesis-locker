import React from 'react'
import { useParams } from 'react-router-dom'
import { Shield, CheckCircle, Lock, ExternalLink } from 'lucide-react'

const MOCK_LOCKS: Record<string, { asset: string; tvl: string; unlockDate: string; chain: string; type: string; isPermanent: boolean }> = {
  '7':  { asset: 'UNI / WETH', tvl: '$2.84M', unlockDate: 'Jun 12, 2026', chain: 'ETH', type: 'LP Lock', isPermanent: false },
  '12': { asset: 'SHIB / WETH', tvl: '$1.12M', unlockDate: 'Jun 18, 2026', chain: 'ETH', type: 'LP Lock', isPermanent: false },
  '3':  { asset: 'CAKE / BNB', tvl: '$880K', unlockDate: 'Jun 28, 2026', chain: 'BNB', type: 'LP Lock', isPermanent: false },
  '19': { asset: 'ARB', tvl: '$640K', unlockDate: 'Jul 3, 2026', chain: 'ETH', type: 'Token Lock', isPermanent: false },
  '1':  { asset: 'ETH / USDC', tvl: '$4.2M', unlockDate: 'Permanent', chain: 'ETH', type: 'LP Lock', isPermanent: true },
}

export function BadgeEmbed() {
  const { id } = useParams<{ id: string }>()
  const lock = MOCK_LOCKS[id || ''] || MOCK_LOCKS['1']

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Genesis Locker Badge</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: transparent;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh;
          }
          .badge {
            display: inline-flex; align-items: center; gap: 10px;
            background: #10110f; border: 1px solid rgba(213, 253, 81,0.35);
            border-radius: 10px; padding: 10px 14px;
            box-shadow: 0 0 16px rgba(213, 253, 81,0.15);
            text-decoration: none; color: inherit;
            font-size: 13px; line-height: 1.4;
          }
          .icon { color: #d5fd51; flex-shrink: 0; }
          .check { color: #22c55e; flex-shrink: 0; }
          .label { font-size: 10px; color: #706d66; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
          .asset { font-size: 14px; font-weight: 700; color: #f7f9f7; }
          .meta { display: flex; gap: 10px; margin-top: 2px; }
          .chip {
            font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px;
            background: rgba(213, 253, 81,0.12); color: #e5feaa;
          }
          .chip.green { background: rgba(34,197,94,0.1); color: #22c55e; }
          .divider { width: 1px; background: rgba(255,255,255,0.07); align-self: stretch; }
          .tvl-label { font-size: 10px; color: #706d66; }
          .tvl-value { font-size: 15px; font-weight: 800; color: #22c55e; font-variant-numeric: tabular-nums; }
          .brand { font-size: 9px; color: #706d66; margin-top: 3px; display: flex; align-items: center; gap: 3px; }
        `}</style>
      </head>
      <body>
        <a className="badge" href={`https://locker.genesispad.app/lock/${id}`} target="_blank" rel="noopener noreferrer">
          <CheckCircle size={18} className="check" style={{ color: '#22c55e' }} />
          <div>
            <div className="label">Verified Lock</div>
            <div className="asset">{lock.asset}</div>
            <div className="meta">
              <span className="chip">{lock.chain}</span>
              <span className="chip">{lock.type}</span>
              {lock.isPermanent && <span className="chip green">Permanent</span>}
            </div>
          </div>
          <div className="divider" />
          <div>
            <div className="tvl-label">TVL Locked</div>
            <div className="tvl-value">{lock.tvl}</div>
            <div className="brand">
              <Shield size={8} style={{ color: '#d5fd51' }} />
              genesispad.app
            </div>
          </div>
        </a>
      </body>
    </html>
  )
}
