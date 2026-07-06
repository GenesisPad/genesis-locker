import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

export type RiskLevel = 'success' | 'warning' | 'danger'

interface RiskBadgeProps {
  level: RiskLevel
  label: string
  showIcon?: boolean
}

const icons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

export function RiskBadge({ level, label, showIcon = true }: RiskBadgeProps) {
  const Icon = icons[level]
  return (
    <span className={`risk-badge ${level}`}>
      {showIcon && <Icon size={10} />}
      {label}
    </span>
  )
}

export const RISK_BADGES = [
  { level: 'success' as RiskLevel, label: 'Permanently Locked' },
  { level: 'warning' as RiskLevel, label: 'Short Lock <30 Days' },
  { level: 'warning' as RiskLevel, label: 'Low Lock % <60%' },
  { level: 'danger' as RiskLevel, label: 'Mint Risk' },
  { level: 'danger' as RiskLevel, label: 'High Tax Risk' },
  { level: 'danger' as RiskLevel, label: 'Blacklist Risk' },
  { level: 'danger' as RiskLevel, label: 'Ownership Not Renounced' },
]
