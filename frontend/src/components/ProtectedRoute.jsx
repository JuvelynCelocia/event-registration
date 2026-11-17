import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icon'

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="grid min-h-[50vh] place-items-center py-16" role="status">
      <div className="flex flex-col items-center gap-4 text-mute">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  )
}

export function LoadingSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4 text-mute">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-brand-ink">
          <Icon name="brand" className="h-8 w-8" strokeWidth={1.8} />
        </span>
        <span className="text-sm font-semibold">Loading Event Registration App…</span>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }) {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) {
    return <LoadingSplash />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return children
}
