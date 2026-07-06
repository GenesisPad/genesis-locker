import { Navigate } from 'react-router-dom'

export function LocksExplorer() {
  return <Navigate to="/projects?tab=locks" replace />
}
