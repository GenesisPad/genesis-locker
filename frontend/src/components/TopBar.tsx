import React, { useState } from 'react'
import { Globe, ChevronDown, Menu } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const chains = ['All Chains', 'Ethereum', 'Base', 'BNB Chain']

export function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const [selected, setSelected] = useState('All Chains')
  const [open, setOpen] = useState(false)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu size={17} />
        </button>
        <div className="chain-menu">
          <button
            className="chain-selector"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >
            <Globe size={13} />
            <span>{selected}</span>
            <ChevronDown size={12} />
          </button>

          {open && (
            <div className="chain-menu-popover">
              {chains.map(c => (
                <button
                  key={c}
                  onClick={() => { setSelected(c); setOpen(false) }}
                  className={`chain-menu-option${c === selected ? ' active' : ''}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <a href="/docs" className="topbar-link">Docs</a>
        <a href="/api" className="topbar-link">API</a>
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="avatar"
        />
      </div>
    </header>
  )
}
