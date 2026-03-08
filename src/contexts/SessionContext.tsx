import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { SessionContext } from '~/hooks/useSession'

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

  const startSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.mutations.startSession),
  })

  const endCurrentSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.mutations.endCurrentSession),
  })

  const setCurrentSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.mutations.setCurrentSession),
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionInternal()
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
