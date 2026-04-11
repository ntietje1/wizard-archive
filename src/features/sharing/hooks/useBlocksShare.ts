import { api } from 'convex/_generated/api'
import { SHARE_STATUS } from 'convex/blockShares/types'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'convex/campaigns/types'
import type { BlockShareInfo } from 'convex/blocks/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { isNote } from '~/features/sidebar/utils/sidebar-item-utils'

export interface ShareItem {
  key: string
  member: CampaignMember
  shareState: 'all' | 'some' | 'none'
}

export const AGGREGATE_SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
  NOT_SHARED: 'not_shared',
  MIXED_SHARED: 'mixed_shared',
} as const

export type AggregateShareStatus =
  (typeof AGGREGATE_SHARE_STATUS)[keyof typeof AGGREGATE_SHARE_STATUS]

export function useBlocksShare(blocks: Array<CustomBlock>) {
  const { item } = useCurrentItem()
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const blockIds = blocks.map((b) => b.id)

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    isNote(item) && blockIds.length > 0 && campaignData ? { noteId: item._id, blockIds } : 'skip',
  )

  const setBlocksShareStatus = useCampaignMutation(api.blockShares.mutations.setBlocksShareStatus)
  const shareBlocks = useCampaignMutation(api.blockShares.mutations.shareBlocks)
  const unshareBlocks = useCampaignMutation(api.blockShares.mutations.unshareBlocks)

  const isMutating =
    setBlocksShareStatus.isPending || shareBlocks.isPending || unshareBlocks.isPending

  const blockInfoMap = (() => {
    const map = new Map<string, BlockShareInfo>()
    for (const block of query.data?.blocks ?? []) {
      map.set(block.blockNoteId, block)
    }
    return map
  })()

  const hasCompleteData = query.data?.blocks && blockIds.every((id) => blockInfoMap.has(id))

  const topLevelBlocks = blocks.filter((b) => blockInfoMap.get(b.id)?.isTopLevel !== false)

  const aggregateShareStatus: AggregateShareStatus = (() => {
    if (!hasCompleteData || topLevelBlocks.length === 0) return AGGREGATE_SHARE_STATUS.NOT_SHARED

    const statuses = topLevelBlocks.map(
      (b) => blockInfoMap.get(b.id)?.shareStatus ?? SHARE_STATUS.NOT_SHARED,
    )

    if (statuses.some((s) => s === SHARE_STATUS.NOT_SHARED)) {
      return AGGREGATE_SHARE_STATUS.NOT_SHARED
    } else if (statuses.every((s) => s === SHARE_STATUS.ALL_SHARED)) {
      return AGGREGATE_SHARE_STATUS.ALL_SHARED
    } else if (statuses.every((s) => s === SHARE_STATUS.INDIVIDUALLY_SHARED)) {
      return AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED
    } else {
      return AGGREGATE_SHARE_STATUS.MIXED_SHARED
    }
  })()

  const unsharedBlocks = topLevelBlocks.filter(
    (b) =>
      (blockInfoMap.get(b.id)?.shareStatus ?? SHARE_STATUS.NOT_SHARED) === SHARE_STATUS.NOT_SHARED,
  )

  const playerMembers = query.data?.playerMembers ?? []

  const getShareState = (memberId: Id<'campaignMembers'>): 'all' | 'some' | 'none' => {
    if (topLevelBlocks.length === 0) return 'none'
    let count = 0
    for (const block of topLevelBlocks) {
      const info = blockInfoMap.get(block.id)
      const status = info?.shareStatus ?? SHARE_STATUS.NOT_SHARED
      if (
        status === SHARE_STATUS.ALL_SHARED ||
        (status === SHARE_STATUS.INDIVIDUALLY_SHARED && info?.sharedMemberIds.includes(memberId))
      ) {
        count++
      }
    }
    if (count === 0) return 'none'
    if (count === topLevelBlocks.length) return 'all'
    return 'some'
  }

  const toggleShareStatus = async () => {
    if (!campaignData?._id || !isNote(item) || isMutating || topLevelBlocks.length === 0) return
    try {
      const blocksToUpdate = unsharedBlocks.length > 0 ? unsharedBlocks : topLevelBlocks
      const newStatus =
        unsharedBlocks.length > 0 ? SHARE_STATUS.ALL_SHARED : SHARE_STATUS.NOT_SHARED

      await setBlocksShareStatus.mutateAsync({
        noteId: item._id,
        blocks: blocksToUpdate.map((b) => ({ blockNoteId: b.id, content: b })),
        status: newStatus,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (!campaignData?._id || !isNote(item) || isMutating || topLevelBlocks.length === 0) return
    try {
      if (getShareState(memberId) === 'all') {
        await unshareBlocks.mutateAsync({
          noteId: item._id,
          blockNoteIds: topLevelBlocks.map((b) => b.id),
          campaignMemberId: memberId,
        })
      } else {
        const blocksToShare = topLevelBlocks.filter((block) => {
          const info = blockInfoMap.get(block.id)
          const status = info?.shareStatus ?? SHARE_STATUS.NOT_SHARED
          return (
            status === SHARE_STATUS.NOT_SHARED ||
            (status === SHARE_STATUS.INDIVIDUALLY_SHARED &&
              !info?.sharedMemberIds.includes(memberId))
          )
        })
        if (blocksToShare.length === 0) return

        await shareBlocks.mutateAsync({
          noteId: item._id,
          blocks: blocksToShare.map((b) => ({ blockNoteId: b.id, content: b })),
          campaignMemberId: memberId,
        })
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const shareItems: Array<ShareItem> = playerMembers.map((member) => ({
    key: `share-${member._id}`,
    member,
    shareState: getShareState(member._id),
  }))

  return {
    query,
    isPending: query.isPending,
    isMutating,
    aggregateShareStatus,
    topLevelBlocks,
    hasNonTopLevelBlocks: topLevelBlocks.length < blocks.length,
    playerMembers,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
  }
}
