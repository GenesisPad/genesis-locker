import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { Home } from './pages/Home'
import { CreateLock } from './pages/CreateLock'
import { LocksExplorer } from './pages/LocksExplorer'
import { LockDetail } from './pages/LockDetail'
import { Analytics } from './pages/Analytics'
import { Dashboard } from './pages/Dashboard'
import { SearchPage } from './pages/Search'
import { Chains } from './pages/Chains'
import { APIPage } from './pages/API'
import { Docs } from './pages/Docs'
import { CommunityGrants } from './pages/CommunityGrants'
import { TokenDetail } from './pages/TokenDetail'
import { LPDetail } from './pages/LPDetail'
import { UnlockCalendar } from './pages/UnlockCalendar'
import { BadgeEmbed } from './pages/BadgeEmbed'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { DAO } from './pages/DAO'
import { wagmiConfig } from './lib/wagmi'
import '@rainbow-me/rainbowkit/styles.css'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({
        accentColor: '#d9ad4a',
        accentColorForeground: 'white',
        borderRadius: 'medium',
        fontStack: 'system',
      })}>
        <BrowserRouter>
          <Routes>
            {/* Standalone — no sidebar/topbar */}
            <Route path="/badge/:id" element={<BadgeEmbed />} />

            {/* App shell */}
            <Route path="/" element={<App />}>
              <Route index element={<Home />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="create" element={<CreateLock />} />
              <Route path="locks" element={<LocksExplorer />} />
              <Route path="lock/:chainId/:id" element={<LockDetail />} />
              <Route path="lock/:id" element={<LockDetail />} />
              <Route path="token/:address" element={<TokenDetail />} />
              <Route path="lp/:address" element={<LPDetail />} />
              <Route path="calendar" element={<UnlockCalendar />} />
              <Route path="projects" element={<Projects />} />
              <Route path="project/:address" element={<ProjectDetail />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="chains" element={<Chains />} />
              <Route path="community-grants" element={<CommunityGrants />} />
              <Route path="dao" element={<DAO />} />
              <Route path="api" element={<APIPage />} />
              <Route path="docs" element={<Docs />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
)
