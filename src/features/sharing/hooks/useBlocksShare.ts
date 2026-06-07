import { api } from 'convex/_generated/api'
import { useMutation } from '@tanstack/react-query'
import { useConvex } from '@convex-dev/react-query'
import { SHARE_STATUS } from 'shared/editor-blocks/share-status'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { hasPermissionForRequirement } from 'shared/permissions/requirements'
import type { BlockShareInfo, CustomBlock } from 'shared/editor-blocks/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { NoteWithContent } from 'shared/notes/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'
import { AGGREGATE_SHARE_STATUS } from '~/features/sharing/utils/block-share-state'
import type { AggregateShareStatus } from '~/features/sharing/utils/block-share-state'

type CampaignMemberId = CampaignMemberSummary['_id']
type BlockVisibilityLevel = typeof PERMISSION_LEVEL.NONE | typeof PERMISSION_LEVEL.VIEW
export type BlockVisibilitySelectValue = 'default' | 'hidden' | 'visible'
export type AggregateBlockVisibilitySelectValue = BlockVisibilitySelectValue | 'mixed'
type BlockShareItemKind = 'controllable' | 'locked_visible'

export interface BlockShareItem {
  key: string
  member: CampaignMemberSummary
  kind: BlockShareItemKind
  permissionLevel: AggregateBlockVisibilitySelectValue
  hasExplicitShare: boolean
}

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

function aggregateValues<T extends string>(values: Array<T>, fallback: T): T | 'mixed' {
  if (values.length === 0) return fallback
  const [first] = values as [T, ...Array<T>]
  return values.every((value) => value === first) ? first : 'mixed'
}

function blockAllPlayersValue(
  blockInfo: BlockShareInfo<CampaignMemberId> | undefined,
): Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'> {
  return blockInfo?.shareStatus === SHARE_STATUS.ALL_SHARED ? 'visible' : 'hidden'
}

function memberPermissionValue(
  blockInfo: BlockShareInfo<CampaignMemberId> | undefined,
  memberId: CampaignMemberId,
): BlockVisibilitySelectValue {
  const permissionLevel = getMemberPermissions(blockInfo)[memberId]
  if (permissionLevel === PERMISSION_LEVEL.NONE) return 'hidden'
  if (permissionLevel === PERMISSION_LEVEL.VIEW) return 'visible'
  return 'default'
}

function getAggregateShareStatus(
  blockInfos: Array<BlockShareInfo<CampaignMemberId>>,
): AggregateShareStatus {
  const values = blockInfos.map((info) => blockAllPlayersValue(info))
  const aggregateValue = aggregateValues(values, 'hidden')
  if (aggregateValue === 'visible') return AGGREGATE_SHARE_STATUS.ALL_SHARED
  if (aggregateValue === 'hidden') {
    const hasMemberOverrides = blockInfos.some(
      (info) => Object.keys(getMemberPermissions(info)).length > 0,
    )
    return hasMemberOverrides
      ? AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED
      : AGGREGATE_SHARE_STATUS.NOT_SHARED
  }
  return AGGREGATE_SHARE_STATUS.MIXED_SHARED
}

function getMemberPermissions(
  blockInfo: BlockShareInfo<CampaignMemberId> | undefined,
): Record<CampaignMemberId, BlockVisibilityLevel> {
  return blockInfo?.memberPermissions ?? {}
}

function createBlockInfoMap(blockInfos: Array<BlockShareInfo<CampaignMemberId>> | undefined) {
  const map = new Map<string, BlockShareInfo<CampaignMemberId>>()
  for (const blockInfo of blockInfos ?? []) {
    map.set(blockInfo.blockNoteId, blockInfo)
  }
  return map
}

export function useBlocksShare(blocks: Array<CustomBlock>, note: NoteWithContent | undefined) {
  const { campaignId, isDm } = useCampaign()
  const convex = useConvex()
  const blockNoteIds = blocks.map((b) => b.id)
  const hasPersistedNote = Boolean(note) && !isOptimisticSidebarItem(note)
  const hasBlocks = blockNoteIds.length > 0

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    note &&
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
  const setBlockMemberPermission = useMutation({
    mutationFn: (args: {
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: CampaignMemberId
      permissionLevel: BlockVisibilityLevel | null
    }) => {
      if (!campaignId) throw new Error('Block sharing requires a campaign context')
      return convex.action(api.blockShares.actions.setBlockMemberPermission, {
        ...args,
        campaignId,
      })
    },
  })

  const isMutating = setBlocksShareStatus.isPending || setBlockMemberPermission.isPending
  const canMutate = canRunBlockShareMutation({
    campaignId,
    isDm,
    isMutating,
    hasPersistedNote,
    hasBlocks,
  })

  const blockInfoMap = createBlockInfoMap(query.data?.blocks)
  const selectedBlockInfos = blockNoteIds.flatMap((blockNoteId) => {
    const blockInfo = blockInfoMap.get(blockNoteId)
    return blockInfo ? [blockInfo] : []
  })
  const hasCompleteData =
    blockNoteIds.length > 0 &&
    Boolean(query.data) &&
    selectedBlockInfos.length === blockNoteIds.length

  const allPlayersPermissionLevel: AggregateBlockVisibilitySelectValue = hasCompleteData
    ? aggregateValues(
        selectedBlockInfos.map((info) => blockAllPlayersValue(info)),
        'hidden',
      )
    : 'hidden'
  const aggregateShareStatus = hasCompleteData
    ? getAggregateShareStatus(selectedBlockInfos)
    : AGGREGATE_SHARE_STATUS.NOT_SHARED

  const shareItems: Array<BlockShareItem> = (query.data?.playerMembers ?? []).map((member) => {
    const notePermissionLevel =
      query.data?.notePermissionsByMemberId[member._id] ?? PERMISSION_LEVEL.NONE
    const isLockedVisible = hasPermissionForRequirement(notePermissionLevel, PERMISSION_LEVEL.EDIT)

    if (isLockedVisible) {
      return {
        key: `block-share-${member._id}`,
        member,
        kind: 'locked_visible',
        permissionLevel: 'visible',
        hasExplicitShare: false,
      }
    }

    const memberValues = selectedBlockInfos.map((info) => memberPermissionValue(info, member._id))
    const hasExplicitShare = memberValues.some((value) => value !== 'default')
    return {
      key: `block-share-${member._id}`,
      member,
      kind: 'controllable',
      permissionLevel: aggregateValues(memberValues, 'default'),
      hasExplicitShare,
    }
  })

  const setAllPlayersPermission = async (
    value: Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'>,
  ) => {
    if (!canMutate || !note) return false
    try {
      await setBlocksShareStatus.mutateAsync({
        noteId: note._id,
        blockNoteIds,
        status: value === 'visible' ? SHARE_STATUS.ALL_SHARED : SHARE_STATUS.NOT_SHARED,
      })
      return true
    } catch (error) {
      handleError(error, 'Failed to update share')
      return false
    }
  }

  const toggleShareStatus = async () => {
    return setAllPlayersPermission(allPlayersPermissionLevel === 'visible' ? 'hidden' : 'visible')
  }

  const setMemberPermission = async (
    memberId: CampaignMemberId,
    value: BlockVisibilitySelectValue,
  ) => {
    if (!canMutate || !note) return
    try {
      await setBlockMemberPermission.mutateAsync({
        noteId: note._id,
        blockNoteIds,
        campaignMemberId: memberId,
        permissionLevel:
          value === 'default'
            ? null
            : value === 'visible'
              ? PERMISSION_LEVEL.VIEW
              : PERMISSION_LEVEL.NONE,
      })
    } catch (error) {
      handleError(error, 'Failed to update player share')
    }
  }

  return {
    query,
    isPending: query.isPending,
    isMutating,
    hasCompleteData,
    aggregateShareStatus,
    allPlayersPermissionLevel,
    shareItems,
    toggleShareStatus,
    setAllPlayersPermission,
    setMemberPermission,
    canShare: canLoadBlockShareData({ campaignId, isDm, hasPersistedNote, hasBlocks }),
  }
}
