import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/contexts/CampaignContext'
import type { SidebarItemId } from 'convex/sidebarItems/types'

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

  const startNewSession = (args: {
    categoryId: Id<'tagCategories'>
    color?: string
    description?: string
    parentId?: SidebarItemId
    endedAt?: number | undefined
  }) => {
    if (!campaignId) return
    const name = `Session ${nextSessionNumber}`
    const nowIso = new Date().toISOString()
    startSession.mutate({
      name,
      color: args.color,
      description: args.description ?? nowIso,
      campaignId,
      categoryId: args.categoryId,
      parentId: args.parentId ?? args.categoryId,
      endedAt: args.endedAt,
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
