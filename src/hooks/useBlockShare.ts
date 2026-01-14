import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { BLOCK_SHARE_STATUS } from 'convex/blocks/types'
import type { CustomBlock } from '~/lib/editor-schema'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'convex/campaigns/types'
import type { BlockShareStatus } from 'convex/blocks/types'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { isNote } from '~/lib/sidebar-item-utils'

export interface ShareItem {
  key: string
  member: CampaignMember
  isShared: boolean
}

export function useBlockShare(block: CustomBlock) {
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign

  const blockWithSharesQuery = useQuery(
    convexQuery(
      api.blocks.queries.getBlockWithShares,
      isNote(item) ? { noteId: item._id, blockId: block.id } : 'skip',
    ),
  )

  const setBlockShareStatus = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.setBlockShareStatus),
  })

  const shareBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.shareBlock),
  })

  const unshareBlock = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.unshareBlock),
  })

  const isMutating =
    setBlockShareStatus.isPending ||
    shareBlock.isPending ||
    unshareBlock.isPending

  const blockData = blockWithSharesQuery.data

  const shareStatus: BlockShareStatus =
    blockData?.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED

  const playerMembers: Array<CampaignMember> = useMemo(
    () => blockData?.playerMembers ?? [],
    [blockData?.playerMembers],
  )

  const sharedMemberIds: Set<Id<'campaignMembers'>> = useMemo(() => {
    if (shareStatus !== BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED) {
      return new Set<Id<'campaignMembers'>>()
    }
    const shares = blockData?.shares ?? []
    return new Set<Id<'campaignMembers'>>(shares.map((s) => s.campaignMemberId))
  }, [blockData?.shares, shareStatus])

  const memberHasAccess = (memberId: Id<'campaignMembers'>): boolean => {
    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        return true
      case BLOCK_SHARE_STATUS.NOT_SHARED:
        return false
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        return sharedMemberIds.has(memberId)
      default:
        return false
    }
  }

  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (!campaign?._id || !isNote(item) || isMutating) return

    const isCurrentlyShared = memberHasAccess(memberId)

    try {
      if (isCurrentlyShared) {
        await unshareBlock.mutateAsync({
          campaignId: campaign._id,
          noteId: item._id,
          blockNoteId: block.id,
          campaignMemberId: memberId,
        })
      } else {
        await shareBlock.mutateAsync({
          campaignId: campaign._id,
          noteId: item._id,
          blockNoteId: block.id,
          campaignMemberId: memberId,
          content: block.content,
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const toggleShareStatus = async () => {
    if (!campaign?._id || !isNote(item) || isMutating) return

    let newStatus: BlockShareStatus
    switch (shareStatus) {
      case BLOCK_SHARE_STATUS.ALL_SHARED:
        newStatus = BLOCK_SHARE_STATUS.NOT_SHARED
        break
      case BLOCK_SHARE_STATUS.NOT_SHARED:
        newStatus = BLOCK_SHARE_STATUS.ALL_SHARED
        break
      case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
        newStatus = BLOCK_SHARE_STATUS.NOT_SHARED
        break
      default:
        newStatus = BLOCK_SHARE_STATUS.ALL_SHARED
    }

    try {
      await setBlockShareStatus.mutateAsync({
        campaignId: campaign._id,
        noteId: item._id,
        blockNoteId: block.id,
        status: newStatus,
        content: block.content,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const shareItems: Array<ShareItem> = useMemo(() => {
    // Deduplicate members by ID to prevent duplicate keys
    const uniqueMembers = playerMembers.filter(
      (member, index, self) =>
        index === self.findIndex((m) => m._id === member._id),
    )

    return uniqueMembers.map((member: CampaignMember) => {
      let isShared: boolean
      switch (shareStatus) {
        case BLOCK_SHARE_STATUS.ALL_SHARED:
          isShared = true
          break
        case BLOCK_SHARE_STATUS.NOT_SHARED:
          isShared = false
          break
        case BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED:
          isShared = sharedMemberIds.has(member._id)
          break
        default:
          isShared = false
      }
      return {
        key: `block-${block.id}-player-${member._id}`,
        member,
        isShared,
      }
    })
  }, [playerMembers, shareStatus, sharedMemberIds, block.id])

  return {
    blockWithSharesQuery,
    isPending: blockWithSharesQuery.isPending,
    shareStatus,
    playerMembers,
    sharedMemberIds,
    isMutating,
    toggleShareStatus,
    toggleShareWithMember,
    shareItems,
  }
}
