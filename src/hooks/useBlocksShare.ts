import { useCallback, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { BLOCK_SHARE_STATUS } from 'convex/blocks/types'
import type { CustomBlock } from '~/lib/editor-schema'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'convex/campaigns/types'
import type { BlockShareInfo } from 'convex/blocks/queries'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { isNote } from '~/lib/sidebar-item-utils'

export interface ShareItem {
  key: string
  member: CampaignMember
  shareState: 'all' | 'some' | 'none'
}

// Aggregate share status for blocks
export type AggregateShareStatus =
  | 'all_shared'
  | 'individually_shared'
  | 'not_shared'
  | 'mixed_shared'

export function useBlocksShare(blocks: Array<CustomBlock>) {
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks])

  const query = useQuery(
    convexQuery(
      api.blocks.queries.getBlocksWithShares,
      isNote(item) && blockIds.length > 0
        ? { noteId: item._id, blockIds }
        : 'skip',
    ),
  )

  const setBlocksShareStatus = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.setBlocksShareStatus),
  })
  const shareBlocks = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.shareBlocks),
  })
  const unshareBlocks = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.unshareBlocks),
  })

  const isMutating =
    setBlocksShareStatus.isPending ||
    shareBlocks.isPending ||
    unshareBlocks.isPending

  const blockInfoMap = useMemo(() => {
    const map = new Map<string, BlockShareInfo>()
    for (const block of query.data?.blocks ?? []) {
      map.set(block.blockNoteId, block)
    }
    return map
  }, [query.data?.blocks])

  const hasCompleteData = useMemo(
    () => query.data?.blocks && blockIds.every((id) => blockInfoMap.has(id)),
    [query.data?.blocks, blockIds, blockInfoMap],
  )

  const topLevelBlocks = useMemo(
    () => blocks.filter((b) => blockInfoMap.get(b.id)?.isTopLevel !== false),
    [blocks, blockInfoMap],
  )

  const aggregateShareStatus: AggregateShareStatus = useMemo(() => {
    if (!hasCompleteData || topLevelBlocks.length === 0) return 'not_shared'

    const statuses = topLevelBlocks.map(
      (b) =>
        blockInfoMap.get(b.id)?.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED,
    )

    if (statuses.some((s) => s === BLOCK_SHARE_STATUS.NOT_SHARED))
      return 'not_shared'
    if (statuses.every((s) => s === BLOCK_SHARE_STATUS.ALL_SHARED))
      return 'all_shared'
    if (statuses.every((s) => s === BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED))
      return 'individually_shared'
    return 'mixed_shared'
  }, [topLevelBlocks, blockInfoMap, hasCompleteData])

  const unsharedBlocks = useMemo(
    () =>
      topLevelBlocks.filter(
        (b) =>
          (blockInfoMap.get(b.id)?.shareStatus ??
            BLOCK_SHARE_STATUS.NOT_SHARED) === BLOCK_SHARE_STATUS.NOT_SHARED,
      ),
    [topLevelBlocks, blockInfoMap],
  )

  const playerMembers = useMemo(
    () => query.data?.playerMembers ?? [],
    [query.data?.playerMembers],
  )

  const getShareState = useCallback(
    (memberId: Id<'campaignMembers'>): 'all' | 'some' | 'none' => {
      if (topLevelBlocks.length === 0) return 'none'
      let count = 0
      for (const block of topLevelBlocks) {
        const info = blockInfoMap.get(block.id)
        const status = info?.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED
        if (
          status === BLOCK_SHARE_STATUS.ALL_SHARED ||
          (status === BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED &&
            info?.sharedMemberIds.includes(memberId))
        ) {
          count++
        }
      }
      if (count === 0) return 'none'
      if (count === topLevelBlocks.length) return 'all'
      return 'some'
    },
    [topLevelBlocks, blockInfoMap],
  )

  const toggleShareStatus = async () => {
    if (
      !campaign?._id ||
      !isNote(item) ||
      isMutating ||
      topLevelBlocks.length === 0
    )
      return
    try {
      const blocksToUpdate =
        unsharedBlocks.length > 0 ? unsharedBlocks : topLevelBlocks
      const newStatus =
        unsharedBlocks.length > 0
          ? BLOCK_SHARE_STATUS.ALL_SHARED
          : BLOCK_SHARE_STATUS.NOT_SHARED

      await setBlocksShareStatus.mutateAsync({
        campaignId: campaign._id,
        noteId: item._id,
        blocks: blocksToUpdate.map((b) => ({ blockNoteId: b.id, content: b })),
        status: newStatus,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (
      !campaign?._id ||
      !isNote(item) ||
      isMutating ||
      topLevelBlocks.length === 0
    )
      return
    try {
      if (getShareState(memberId) === 'all') {
        await unshareBlocks.mutateAsync({
          campaignId: campaign._id,
          noteId: item._id,
          blockNoteIds: topLevelBlocks.map((b) => b.id),
          campaignMemberId: memberId,
        })
      } else {
        const blocksToShare = topLevelBlocks.filter((block) => {
          const info = blockInfoMap.get(block.id)
          const status = info?.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED
          return (
            status === BLOCK_SHARE_STATUS.NOT_SHARED ||
            (status === BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED &&
              !info?.sharedMemberIds.includes(memberId))
          )
        })
        if (blocksToShare.length === 0) return

        await shareBlocks.mutateAsync({
          campaignId: campaign._id,
          noteId: item._id,
          blocks: blocksToShare.map((b) => ({ blockNoteId: b.id, content: b })),
          campaignMemberId: memberId,
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }

  const shareItems: Array<ShareItem> = useMemo(
    () =>
      playerMembers.map((member) => ({
        key: `share-${member._id}`,
        member,
        shareState: getShareState(member._id),
      })),
    [playerMembers, getShareState],
  )

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
