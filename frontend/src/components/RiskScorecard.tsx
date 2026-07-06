import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react'

export type RiskCheck = {
  label: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  value: string
}

export type RiskScorecardProps = {
  score: number        // 0–100, lower = safer
  level: 'Low' | 'Medium' | 'High'
  checks: RiskCheck[]
}

function statusIcon(status: RiskCheck['status']) {
  if (status === 'pass') return <CheckCircle size={13} color="var(--success)" />
  if (status === 'fail') return <XCircle size={13} color="var(--danger)" />
  if (status === 'warn') return <AlertTriangle size={13} color="var(--warning)" />
  return <Shield size={13} color="var(--dim)" />
}

function statusColor(status: RiskCheck['status']) {
  if (status === 'pass') return 'var(--success)'
  if (status === 'fail') return 'var(--danger)'
  if (status === 'warn') return 'var(--warning)'
  return 'var(--dim)'
}

function levelColor(level: RiskScorecardProps['level']) {
  if (level === 'Low') return 'var(--success)'
  if (level === 'Medium') return 'var(--warning)'
  return 'var(--danger)'
}

function levelBg(level: RiskScorecardProps['level']) {
  if (level === 'Low') return 'rgba(34,197,94,0.08)'
  if (level === 'Medium') return 'rgba(245,158,11,0.08)'
  return 'rgba(239,68,68,0.08)'
}

function levelBorder(level: RiskScorecardProps['level']) {
  if (level === 'Low') return 'rgba(34,197,94,0.2)'
  if (level === 'Medium') return 'rgba(245,158,11,0.2)'
  return 'rgba(239,68,68,0.2)'
}

export function RiskScorecard({ score, level, checks }: RiskScorecardProps) {
  const barColor = levelColor(level)

  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${levelBorder(level)}`,
      borderRadius: 10, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={15} color={barColor} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Risk Analysis</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4,
          background: levelBg(level), color: barColor, border: `1px solid ${levelBorder(level)}`,
        }}>
          {level} Risk
        </span>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>Risk Score</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
            {score} / 100
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${score}%`, borderRadius: 999,
            background: barColor, transition: 'width 0.8s ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9.5, color: 'var(--success)' }}>Safe</span>
          <span style={{ fontSize: 9.5, color: 'var(--danger)' }}>Danger</span>
        </div>
      </div>

      {/* Checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {checks.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 6,
            background: 'rgba(255,255,255,0.025)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {statusIcon(c.status)}
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(c.status) }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function mockRiskData(address: string): RiskScorecardProps {
  const seed = address ? parseInt(address.slice(2, 8) || '0', 16) : 0
  const low = seed % 3 === 0
  const med = seed % 3 === 1

  if (low) {
    return {
      score: 18, level: 'Low',
      checks: [
        { label: 'Mint Authority', status: 'pass', value: 'Renounced' },
        { label: 'Contract Ownership', status: 'pass', value: 'Renounced' },
        { label: 'Honeypot Simulation', status: 'pass', value: 'Safe' },
        { label: 'Buy Tax', status: 'pass', value: '0%' },
        { label: 'Sell Tax', status: 'pass', value: '0%' },
        { label: 'Blacklist Function', status: 'pass', value: 'None detected' },
        { label: 'Proxy Contract', status: 'info', value: 'No' },
      ],
    }
  }
  if (med) {
    return {
      score: 54, level: 'Medium',
      checks: [
        { label: 'Mint Authority', status: 'warn', value: 'Active' },
        { label: 'Contract Ownership', status: 'pass', value: 'Renounced' },
        { label: 'Honeypot Simulation', status: 'pass', value: 'Safe' },
        { label: 'Buy Tax', status: 'warn', value: '3%' },
        { label: 'Sell Tax', status: 'warn', value: '5%' },
        { label: 'Blacklist Function', status: 'pass', value: 'None detected' },
        { label: 'Proxy Contract', status: 'info', value: 'No' },
      ],
    }
  }
  return {
    score: 78, level: 'High',
    checks: [
      { label: 'Mint Authority', status: 'fail', value: 'Active' },
      { label: 'Contract Ownership', status: 'fail', value: 'Not renounced' },
      { label: 'Honeypot Simulation', status: 'warn', value: 'Inconclusive' },
      { label: 'Buy Tax', status: 'warn', value: '8%' },
      { label: 'Sell Tax', status: 'fail', value: '15%' },
      { label: 'Blacklist Function', status: 'fail', value: 'Detected' },
      { label: 'Proxy Contract', status: 'warn', value: 'Yes' },
    ],
  }
}
