import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/hooks/useCampaign'

export const useSession = () => {
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

  const startNewSession = (args?: { name?: string }) => {
    if (!campaignId) return Promise.reject(new Error('Campaign ID is required'))
    const name = args?.name ?? `Session ${nextSessionNumber}`
    return startSession.mutateAsync({
      name,
      campaignId,
    })
  }

  return {
    currentSession,
    sessions,
    startSession,
    endCurrentSession,
    setCurrentSession,
    nextSessionNumber,
    startNewSession,
  }
}
