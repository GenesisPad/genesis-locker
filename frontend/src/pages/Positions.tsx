import React from 'react'
import { LocksExplorer } from './LocksExplorer'

export function Positions() {
  return (
    <LocksExplorer
      initialFilter="v3"
      title="Locked Positions"
      description="Launch-created liquidity positions that are permanently held in Genesis Locker. Liquidity stays locked; trading fees are handled separately."
    />
  )
}
