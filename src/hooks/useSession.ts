import { createContext, useContext } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import type { Session } from 'convex/sessions/types'

export type SessionContextValue = {
  currentSession: UseQueryResult<Session | null, Error>
  sessions: UseQueryResult<Array<Session>, Error>
  startSession: UseMutationResult<
    Id<'sessions'>,
    Error,
    { campaignId: Id<'campaigns'>; name?: string }
  >
  endCurrentSession: UseMutationResult<
    Id<'sessions'>,
    Error,
    { campaignId: Id<'campaigns'> }
  >
  setCurrentSession: UseMutationResult<
    Id<'sessions'>,
    Error,
    { campaignId: Id<'campaigns'>; sessionId: Id<'sessions'> }
  >
  nextSessionNumber: number
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
