import { Navigate, useParams } from 'react-router-dom'

export function TokenDetail() {
  const { address } = useParams<{ address: string }>()
  return <Navigate to={`/project/${address}`} replace />
}
