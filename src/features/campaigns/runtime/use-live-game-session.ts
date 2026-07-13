import { api } from 'convex/_generated/api'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { Session } from 'shared/sessions/types'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

type SessionContextValue = {
  currentSession: UseQueryResult<Session | null, Error>
  sessions: UseQueryResult<Array<Session>, Error>
  startSession: UseMutationResult<SessionId, Error, { name?: string }>
  endCurrentSession: UseMutationResult<SessionId, Error, Record<string, never>>
  setCurrentSession: UseMutationResult<SessionId, Error, { sessionId: SessionId }>
  nextSessionNumber: number
}

export function useLiveGameSession(): SessionContextValue {
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
