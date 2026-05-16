import { api } from 'convex/_generated/api'
import { SHARE_STATUS } from 'convex/blockShares/types'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteWithContent } from 'convex/notes/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { resolveBlockShareState } from '~/features/sharing/utils/block-share-state'
export {
  AGGREGATE_SHARE_STATUS,
  type AggregateShareStatus,
  type ShareItem,
} from '~/features/sharing/utils/block-share-state'

export function useBlocksShare(blocks: Array<CustomBlock>, note: NoteWithContent) {
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const blockNoteIds = blocks.map((b) => b.id)

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    blockNoteIds.length > 0 && campaignData ? { noteId: note._id, blockNoteIds } : 'skip',
  )

  const setBlocksShareStatus = useCampaignMutation(api.blockShares.mutations.setBlocksShareStatus)
  const shareBlocks = useCampaignMutation(api.blockShares.mutations.shareBlocks)
  const unshareBlocks = useCampaignMutation(api.blockShares.mutations.unshareBlocks)

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
