import { Navigate, useParams } from 'react-router-dom'

export function LPDetail() {
  const { address } = useParams<{ address: string }>()
  return <Navigate to={`/project/${address}`} replace />
}
