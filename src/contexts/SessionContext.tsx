import { api } from 'convex/_generated/api'
import { useAppMutation } from '~/hooks/useAppMutation'
import { useCampaign } from '~/hooks/useCampaign'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { SessionContext } from '~/hooks/useGameSession'

function useSessionInternal() {
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
    errorMessage: 'Failed to start session',
  })

  const endCurrentSession = useAppMutation(
    api.sessions.mutations.endCurrentSession,
    { errorMessage: 'Failed to end session' },
  )

  const setCurrentSession = useAppMutation(
    api.sessions.mutations.setCurrentSession,
    { errorMessage: 'Failed to set session' },
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionInternal()
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
