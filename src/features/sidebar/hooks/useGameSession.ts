import { api } from 'convex/_generated/api'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import type { Session } from 'convex/sessions/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

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
    { sessionId: Id<'sessions'> }
  >
  nextSessionNumber: number
}

export function useSession(): SessionContextValue {
  const { campaignId } = useCampaign()

  const currentSession = useAuthQuery(
    api.sessions.queries.getCurrentSession,
    campaignId ? { campaignId } : 'skip',
  )

  const sessions = useAuthQuery(
    api.sessions.queries.getSessionsByCampaign,
    campaignId ? { campaignId } : 'skip',
  )

  const startSession = useAppMutation(api.sessions.mutations.startSession, {
    onError: (error) => handleError(error, 'Failed to start session'),
  })

  const endCurrentSession = useAppMutation(
    api.sessions.mutations.endCurrentSession,
    { onError: (error) => handleError(error, 'Failed to end session') },
  )

  const setCurrentSession = useAppMutation(
    api.sessions.mutations.setCurrentSession,
    { onError: (error) => handleError(error, 'Failed to set session') },
  )

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
