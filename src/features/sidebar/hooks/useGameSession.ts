import { api } from 'convex/_generated/api'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import type { Session } from 'convex/sessions/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

export type SessionContextValue = {
  currentSession: UseQueryResult<Session | null, Error>
  sessions: UseQueryResult<Array<Session>, Error>
  startSession: UseMutationResult<Id<'sessions'>, Error, { name?: string }>
  endCurrentSession: UseMutationResult<Id<'sessions'>, Error, Record<string, never>>
  setCurrentSession: UseMutationResult<Id<'sessions'>, Error, { sessionId: Id<'sessions'> }>
  nextSessionNumber: number
}

export function useSession(): SessionContextValue {
  const currentSession = useCampaignQuery(api.sessions.queries.getCurrentSession, {})

  const sessions = useCampaignQuery(api.sessions.queries.getSessionsByCampaign, {})

  const startSession = useCampaignMutation(api.sessions.mutations.startSession, {
    onError: (error) => handleError(error, 'Failed to start session'),
  })

  const endCurrentSession = useCampaignMutation(api.sessions.mutations.endCurrentSession, {
    onError: (error) => handleError(error, 'Failed to end session'),
  })

  const setCurrentSession = useCampaignMutation(api.sessions.mutations.setCurrentSession, {
    onError: (error) => handleError(error, 'Failed to set session'),
  })

  const nextSessionNumber = (sessions.data?.length ?? 0) + 1

  return {
    currentSession,
    sessions,
    startSession,
    endCurrentSession,
    setCurrentSession,
    nextSessionNumber,
  }
}
