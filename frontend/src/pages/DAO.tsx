import React from 'react'
import { motion } from 'framer-motion'
import { Vote, Lock as LockIcon, ExternalLink } from 'lucide-react'

/**
 * DAO Governance is not live. GenesisLockerDAO.sol exists in the contracts
 * package but has never been deployed to any chain, so there is no on-chain
 * governance to read proposals, votes, or treasury balances from. This page
 * intentionally shows that plainly rather than any fabricated proposals or
 * vote counts - it was previously seeded with entirely fictional data.
 */
export function DAO() {
  return (
    <div className="inner-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title">DAO Governance</h1>
        <p className="page-desc">Community governance over treasury, contributors, and platform parameters.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '48px 32px', textAlign: 'center', maxWidth: 560, margin: '40px auto 0',
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: 'rgba(221, 179, 83,0.1)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <Vote size={22} color="var(--accent)" />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Governance isn't live yet</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          Genesis Locker's governance contract exists in the codebase but has not been deployed to any chain.
          There are no real proposals, votes, or treasury data to show — this page will populate once
          the DAO contract goes live and community voting opens.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--dim)' }}>
          <LockIcon size={12} />
          Locked funds and platform fees are unaffected — this only concerns future governance features.
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}
      >
        <a
          href="https://github.com/GenesisPad/genesis-locker/blob/main/contracts/contracts/GenesisLockerDAO.sol"
          target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}
        >
          View the governance contract source <ExternalLink size={12} />
        </a>
      </motion.div>
    </div>
  )
}
