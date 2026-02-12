import { createContext, useContext } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'

type SessionContextValue = ReturnType<typeof useSessionInternal>

const SessionContext = createContext<SessionContextValue | null>(null)

function useSessionInternal() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

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

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
