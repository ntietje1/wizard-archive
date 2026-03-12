import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

/**
 * Defers navigation until Convex auth confirms the session is active.
 * Handles both fresh sign-ins and account switches.
 */
export function usePendingAuthRedirect(onNavigate?: () => void) {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  const queueRedirect = useCallback((url: string) => {
    setPendingRedirect(url)
  }, [])

  useEffect(() => {
    if (!pendingRedirect || isLoading) return

    if (isAuthenticated) {
      navigate({ to: pendingRedirect })
      setPendingRedirect(null)
      onNavigateRef.current?.()
    }
  }, [pendingRedirect, isAuthenticated, isLoading, navigate])

  return queueRedirect
}
