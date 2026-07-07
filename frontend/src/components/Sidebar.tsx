import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home, Search, Lock, LayoutDashboard,
  BarChart2, Link2, Code2, BookOpen,
  Github, HandHeart, CalendarClock, Trophy, Vote,
} from 'lucide-react'

// ── Brand-accurate SVG icons ────────────────────────────────────────────────

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.625L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.944 3.204 2.31 10.88c-1.33.534-1.322 1.276-.243 1.607l4.998 1.56 11.58-7.31c.547-.332 1.047-.154.636.212L8.963 16.36l-.372 5.18c.547 0 .788-.252 1.092-.546l2.62-2.547 5.45 4.024c1.004.554 1.726.268 1.977-.932l3.576-16.85c.366-1.468-.56-2.133-1.362-1.485z" />
    </svg>
  )
}

// ── Nav structure ────────────────────────────────────────────────────────────

const navSections = [
  {
    label: 'Platform',
    items: [
      { to: '/',          label: 'Home',            icon: Home,          exact: true },
      { to: '/search',    label: 'Search',           icon: Search },
      { to: '/create',    label: 'Create Lock',      icon: Lock,          badge: 'NEW' },
      { to: '/calendar',  label: 'Unlock Calendar',  icon: CalendarClock },
      { to: '/projects',  label: 'Projects & Locks', icon: Trophy },
      { to: '/dashboard', label: 'My Locks',         icon: LayoutDashboard },
      { to: '/analytics', label: 'TVL & Analytics',  icon: BarChart2 },
      { to: '/chains',    label: 'Chains',           icon: Link2 },
    ],
  },
  {
    label: 'Community',
    items: [
      { to: '/community-grants', label: 'Community Grants', icon: HandHeart },
      { to: '/dao',              label: 'DAO Governance',   icon: Vote,     badge: 'LIVE' },
    ],
  },
  {
    label: 'Developers',
    items: [
      { to: '/api',  label: 'API',  icon: Code2 },
      { to: '/docs', label: 'Docs', icon: BookOpen },
    ],
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <aside className={`sidebar${className ? ` ${className}` : ''}`}>
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Genesis Locker" className="sidebar-logomark" />
        <div className="sidebar-brand">
          <span className="sidebar-brand-name">GENESIS LOCKER</span>
          <span className="sidebar-brand-tag">Decentralized</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navSections.map(section => (
          <React.Fragment key={section.label}>
            <div className="sidebar-group-label">{section.label}</div>
            {section.items.map(({ to, label, icon: Icon, badge, exact }) => {
              const isActive = exact
                ? location.pathname === to
                : location.pathname.startsWith(to) && to !== '/'

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  onClick={onNavigate}
                >
                  <span className="nav-item-icon">
                    <Icon size={14} />
                  </span>
                  {label}
                  {badge && <span className="nav-badge">{badge}</span>}
                </NavLink>
              )
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="contract-card">
          <div className="contract-card-label">Contract Status</div>
          <div className="contract-status-row">
            <span className="status-pulse" />
            Ownership Renounced
          </div>
        </div>

        <div className="sidebar-socials">
          <a href="#" className="social-btn" aria-label="X (Twitter)" title="X (Twitter)">
            <XIcon size={15} />
          </a>
          <a href="#" className="social-btn" aria-label="Telegram" title="Telegram">
            <TelegramIcon size={15} />
          </a>
          <a href="https://github.com/GenesisPad/genesis-locker" target="_blank" rel="noreferrer" className="social-btn" aria-label="GitHub" title="GitHub">
            <Github size={15} />
          </a>
        </div>
      </div>
    </aside>
  )
}
