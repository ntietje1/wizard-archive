import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'
import { SessionContext } from '~/hooks/useSession'

function useSessionInternal() {
  const { campaignId } = useCampaign()

  const currentSession = useQuery(
    convexQuery(
      api.sessions.queries.getCurrentSession,
      campaignId
        ? {
            campaignId,
          }
        : 'skip',
    ),
  )

  const sessions = useQuery(
    convexQuery(
      api.sessions.queries.getSessionsByCampaign,
      campaignId ? { campaignId } : 'skip',
    ),
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
