import { api } from 'convex/_generated/api'
import { useMutation } from '@tanstack/react-query'
import { useConvex } from '@convex-dev/react-query'
import { SHARE_STATUS } from 'convex/blockShares/types'
import type { CustomBlock } from 'convex/blocks/types'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteWithContent } from 'convex/notes/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { resolveBlockShareState } from '~/features/sharing/utils/block-share-state'
export {
  AGGREGATE_SHARE_STATUS,
  type AggregateShareStatus,
  type ShareItem,
} from '~/features/sharing/utils/block-share-state'

export function useBlocksShare(blocks: Array<CustomBlock>, note: NoteWithContent) {
  const { campaign, campaignId } = useCampaign()
  const convex = useConvex()
  const campaignData = campaign.data
  const blockNoteIds = blocks.map((b) => b.id)

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    blockNoteIds.length > 0 && campaignData ? { noteId: note._id, blockNoteIds } : 'skip',
  )

  const setBlocksShareStatus = useMutation({
    mutationFn: (args: {
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      status: (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]
    }) => {
      if (!campaignId) throw new Error('Block sharing requires a campaign context')
      return convex.action(api.blockShares.actions.setBlocksShareStatus, { ...args, campaignId })
    },
  })
  const shareBlocks = useMutation({
    mutationFn: (args: {
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: Id<'campaignMembers'>
    }) => {
      if (!campaignId) throw new Error('Block sharing requires a campaign context')
      return convex.action(api.blockShares.actions.shareBlocks, { ...args, campaignId })
    },
  })
  const unshareBlocks = useMutation({
    mutationFn: (args: {
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: Id<'campaignMembers'>
    }) => {
      if (!campaignId) throw new Error('Block sharing requires a campaign context')
      return convex.action(api.blockShares.actions.unshareBlocks, { ...args, campaignId })
    },
  })

  const isMutating =
    setBlocksShareStatus.isPending || shareBlocks.isPending || unshareBlocks.isPending

  const playerMembers = query.data?.playerMembers ?? []
  const {
    aggregateShareStatus,
    unsharedBlocks,
    shareItems,
    getShareStateForMember,
    getBlocksToShareWithMember,
  } = resolveBlockShareState({
    blocks,
    blockInfos: query.data?.blocks,
    blockNoteIds,
    playerMembers,
  })
  const canMutate = !!campaignData?._id && !isMutating && blocks.length > 0

  const toggleShareStatus = async () => {
    if (!canMutate) return
    try {
      const blocksToUpdate = unsharedBlocks.length > 0 ? unsharedBlocks : blocks
      const newStatus =
        unsharedBlocks.length > 0 ? SHARE_STATUS.ALL_SHARED : SHARE_STATUS.NOT_SHARED

      await setBlocksShareStatus.mutateAsync({
        noteId: note._id,
        blockNoteIds: blocksToUpdate.map((b) => b.id),
        status: newStatus,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (!canMutate) return
    try {
      if (getShareStateForMember(memberId) === 'all') {
        await unshareBlocks.mutateAsync({
          noteId: note._id,
          blockNoteIds: blocks.map((b) => b.id),
          campaignMemberId: memberId,
        })
      } else {
        const blocksToShare = getBlocksToShareWithMember(memberId)
        if (blocksToShare.length === 0) return

        await shareBlocks.mutateAsync({
          noteId: note._id,
          blockNoteIds: blocksToShare.map((b) => b.id),
          campaignMemberId: memberId,
        })
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  return {
    query,
    isPending: query.isPending,
    isMutating,
    aggregateShareStatus,
    playerMembers,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
  }
}
