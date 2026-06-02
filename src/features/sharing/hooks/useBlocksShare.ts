import { api } from 'convex/_generated/api'
import { useMutation } from '@tanstack/react-query'
import { useConvex } from '@convex-dev/react-query'
import { SHARE_STATUS } from 'shared/editor-blocks/share-status'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'shared/campaigns/types'
import type { NoteWithContent } from 'shared/notes/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { resolveBlockShareState } from '~/features/sharing/utils/block-share-state'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

type CampaignMemberId = CampaignMember['_id']

function canLoadBlockShareData({
  campaignId,
  isDm,
  hasPersistedNote,
  hasBlocks,
}: {
  campaignId: Id<'campaigns'> | undefined
  isDm: boolean | undefined
  hasPersistedNote: boolean
  hasBlocks: boolean
}): boolean {
  return Boolean(campaignId) && Boolean(isDm) && hasPersistedNote && hasBlocks
}

function canRunBlockShareMutation({
  campaignId,
  isDm,
  isMutating,
  hasPersistedNote,
  hasBlocks,
}: {
  campaignId: Id<'campaigns'> | undefined
  isDm: boolean | undefined
  isMutating: boolean
  hasPersistedNote: boolean
  hasBlocks: boolean
}): boolean {
  return Boolean(campaignId) && Boolean(isDm) && hasPersistedNote && hasBlocks && !isMutating
}

export function useBlocksShare(blocks: Array<CustomBlock>, note: NoteWithContent) {
  const { campaignId, isDm } = useCampaign()
  const convex = useConvex()
  const blockNoteIds = blocks.map((b) => b.id)
  const hasPersistedNote = !isOptimisticSidebarItem(note)
  const hasBlocks = blockNoteIds.length > 0

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    canLoadBlockShareData({
      campaignId,
      isDm,
      hasPersistedNote,
      hasBlocks,
    })
      ? { noteId: note._id, blockNoteIds }
      : 'skip',
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
      campaignMemberId: CampaignMemberId
    }) => {
      if (!campaignId) throw new Error('Block sharing requires a campaign context')
      return convex.action(api.blockShares.actions.shareBlocks, { ...args, campaignId })
    },
  })
  const unshareBlocks = useMutation({
    mutationFn: (args: {
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: CampaignMemberId
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
  const canMutate = canRunBlockShareMutation({
    campaignId,
    isDm,
    isMutating,
    hasPersistedNote,
    hasBlocks,
  })

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

  const toggleShareWithMember = async (memberId: CampaignMemberId) => {
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
    canShare: canLoadBlockShareData({ campaignId, isDm, hasPersistedNote, hasBlocks }),
  }
}
