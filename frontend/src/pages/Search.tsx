import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { RiskBadge } from '../components/RiskBadge'
import { api, SearchResult, shortAddress } from '../lib/api'

function resultTitle(result: SearchResult) {
  if (result.type === 'lock') return `Lock #${result.lockId}`
  return result.symbol || result.name || shortAddress(result.address)
}

function resultSubtitle(result: SearchResult) {
  if (result.type === 'lock') return `${shortAddress(result.assetAddress)} · Chain ${result.chainId}`
  return `${result.type === 'pair' ? 'LP Pair' : 'Token'} · Chain ${result.chainId}`
}

export function SearchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [submitted, setSubmitted] = useState(!!params.get('q'))
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(nextQuery = query) {
    if (!nextQuery.trim()) return
    setSubmitted(true)
    setLoading(true)
    setError('')
    try {
      const response = await api.search(nextQuery)
      setResults(response.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = params.get('q')
    if (q) void handleSearch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="search-page">
      <motion.div
        className="search-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="page-title" style={{ marginBottom: 6 }}>Token & LP Search</h1>
        <p className="page-desc">
          Search any token contract, LP pair, wallet address, or lock ID across all supported chains.
        </p>
      </motion.div>

      <div className="search-bar" style={{ maxWidth: '100%', marginBottom: 12 }}>
        <span className="search-icon"><Search size={15} /></span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Paste token address, LP pair, wallet or lock ID..."
          autoFocus
        />
        <button className="search-submit" onClick={() => handleSearch()}>Search</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
        <span style={{ fontSize: 11, color: 'var(--dim)', marginRight: 4 }}>Quick filter:</span>
        {['Ethereum', 'Base', 'BNB Chain', 'LP Pairs', 'Tokens', 'Permanent Only'].map(tag => (
          <button key={tag} className="filter-btn" style={{ fontSize: 11, padding: '5px 10px' }}>
            {tag}
          </button>
        ))}
      </div>

      {submitted && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14 }}>
            {loading ? 'Searching...' : `${results.length} results for "${query}"`}
          </div>
          {error && <div className="form-alert error">{error}</div>}

          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.chainId}-${result.lockId || result.address || index}`}
              className="search-result-card"
              onClick={() => {
              if (result.type === 'lock' && result.lockId) return navigate(`/lock/${result.chainId}/${result.lockId}`)
              const addr = result.address || result.assetAddress
              if (result.type === 'token' && addr) return navigate(`/project/${addr}`)
              if (result.type === 'pair' && addr) return navigate(`/project/${addr}`)
              navigate(`/search?q=${addr || query}`)
            }}
            >
              <div className="result-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="asset-avatar" style={{ background: '#242018', color: '#f1cb73', width: 36, height: 36, borderRadius: 10 }}>
                    {resultTitle(result).slice(0, 2)}
                  </div>
                  <div>
                    <div className="result-name">{resultTitle(result)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{resultSubtitle(result)}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--dim)" />
              </div>

              <div className="result-meta-row">
                <div>
                  <div className="result-metric-label">Address</div>
                  <div className="result-metric-val">{shortAddress(result.assetAddress || result.address)}</div>
                </div>
                <div>
                  <div className="result-metric-label">Lock %</div>
                  <div className="result-metric-val" style={{ color: 'var(--success)' }}>{result.lockedPercentage || '-'}</div>
                </div>
                <div>
                  <div className="result-metric-label">Type</div>
                  <div className="result-metric-val">{result.type}</div>
                </div>
                <div>
                  <div className="result-metric-label">Permanent</div>
                  <div className="result-metric-val">{result.isPermanent ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <RiskBadge level={result.isPermanent ? 'success' : 'warning'} label={result.isPermanent ? 'Permanently Locked' : 'Indexed Result'} />
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {!submitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ color: 'var(--dim)', fontSize: 13, textAlign: 'center', paddingTop: 48 }}
        >
          <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p>Enter a token address, LP pair, wallet, or lock ID to search.</p>
        </motion.div>
      )}
    </div>
  )
}
