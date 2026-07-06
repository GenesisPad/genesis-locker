import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'

export function App() {
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <TopBar onOpenMenu={() => setMobileNavOpen(true)} />
        <div className="page-scroll" ref={scrollRef}>
          <Outlet />
        </div>
      </div>
      {mobileNavOpen && (
        <div className="mobile-nav-overlay" role="presentation" onClick={() => setMobileNavOpen(false)}>
          <div className="mobile-nav-panel" role="dialog" aria-label="Navigation" onClick={event => event.stopPropagation()}>
            <Sidebar className="mobile-sidebar" onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
