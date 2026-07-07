import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ChevronRight, Lock, Search, Code2, Shield } from 'lucide-react'

const SECTIONS = [
  {
    icon: Lock,
    title: 'Getting Started',
    color: 'var(--accent)',
    items: ['What is Genesis Locker?', 'How locking works', 'Supported chains', 'Platform fees'],
  },
  {
    icon: Lock,
    title: 'Creating Locks',
    color: 'var(--accent-alt)',
    items: ['LP Token Locks', 'Token Locks', 'Cliff locks', 'Vesting locks', 'Permanent locks'],
  },
  {
    icon: Search,
    title: 'Searching & Verification',
    color: 'var(--success)',
    items: ['Search by contract address', 'Search by LP pair', 'Search by wallet', 'Lock verification page'],
  },
  {
    icon: Code2,
    title: 'API Reference',
    color: 'var(--warning)',
    items: ['Authentication', 'GET /v1/lock/:id', 'GET /v1/check/:chain/:address', 'GET /v1/search'],
  },
  {
    icon: Shield,
    title: 'Security',
    color: '#f87171',
    items: ['Contract architecture', 'Audit reports', 'Ownership renouncement', 'Bug bounty'],
  },
]

export function Docs() {
  const [active, setActive] = useState(SECTIONS[0].title)
  const section = SECTIONS.find(s => s.title === active) || SECTIONS[0]

  return (
    <div className="inner-page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <BookOpen size={22} color="var(--accent)" />
          <h1 className="page-title" style={{ marginBottom: 0 }}>Documentation</h1>
        </div>
        <p className="page-desc">
          Everything you need to integrate, build on, and use Genesis Locker.
        </p>
      </motion.div>

      <div className="docs-layout">
        {/* Sidebar nav */}
        <div className="docs-nav">
          {SECTIONS.map(s => (
            <button
              key={s.title}
              onClick={() => setActive(s.title)}
              className={`nav-item${active === s.title ? ' active' : ''}`}
              style={{ width: '100%', marginBottom: 2 }}
            >
              <s.icon size={13} color={active === s.title ? s.color : undefined} />
              {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="dash-card docs-content"
          style={{ alignSelf: 'start' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <section.icon size={18} color={section.color} />
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{section.title}</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {section.items.map(item => (
              <button
                key={item}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 'var(--r-sm)',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13.5, textAlign: 'left',
                  transition: 'all 140ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
              >
                {item}
                <ChevronRight size={14} color="var(--dim)" />
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(217, 173, 74,0.04)', border: '1px solid rgba(217, 173, 74,0.12)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--muted)' }}>
            Full documentation coming soon. Join Discord for real-time support.
          </div>
        </motion.div>
      </div>
    </div>
  )
}
