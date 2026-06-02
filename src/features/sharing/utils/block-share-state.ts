import { SHARE_STATUS } from 'shared/editor-blocks/share-status'
import type { BlockShareInfo, CustomBlock } from 'shared/editor-blocks/types'
import type { CampaignMember } from 'shared/campaigns/types'

type CampaignMemberId = CampaignMember['_id']
type ShareState = 'all' | 'some' | 'none'

export interface ShareItem {
  key: string
  member: CampaignMember
  shareState: ShareState
}

export const AGGREGATE_SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
  NOT_SHARED: 'not_shared',
  MIXED_SHARED: 'mixed_shared',
} as const

export type AggregateShareStatus =
  (typeof AGGREGATE_SHARE_STATUS)[keyof typeof AGGREGATE_SHARE_STATUS]

export function resolveBlockShareState({
  blocks,
  blockInfos,
  blockNoteIds,
  playerMembers,
}: {
  blocks: Array<CustomBlock>
  blockInfos: Array<BlockShareInfo<CampaignMemberId>> | undefined
  blockNoteIds: Array<string>
  playerMembers: Array<CampaignMember>
}) {
  const blockInfoMap = createBlockInfoMap(blockInfos)
  const hasCompleteData = !!blockInfos && blockNoteIds.every((id) => blockInfoMap.has(id))

  return {
    aggregateShareStatus: getAggregateShareStatus(blocks, blockInfoMap, hasCompleteData),
    unsharedBlocks: blocks.filter(
      (block) => getBlockShareStatus(block, blockInfoMap) === SHARE_STATUS.NOT_SHARED,
    ),
    shareItems: playerMembers.map((member) => ({
      key: `share-${member._id}`,
      member,
      shareState: getShareState(blocks, blockInfoMap, member._id),
    })),
    getShareStateForMember: (memberId: CampaignMemberId) =>
      getShareState(blocks, blockInfoMap, memberId),
    getBlocksToShareWithMember: (memberId: CampaignMemberId) =>
      getBlocksToShareWithMember(blocks, blockInfoMap, memberId),
  }
}

function createBlockInfoMap(blocks: Array<BlockShareInfo<CampaignMemberId>> | undefined) {
  const map = new Map<string, BlockShareInfo<CampaignMemberId>>()
  for (const block of blocks ?? []) {
    map.set(block.blockNoteId, block)
  }
  return map
}

function getBlockShareStatus(
  block: CustomBlock,
  blockInfoMap: Map<string, BlockShareInfo<CampaignMemberId>>,
): BlockShareInfo<CampaignMemberId>['shareStatus'] {
  return blockInfoMap.get(block.id)?.shareStatus ?? SHARE_STATUS.NOT_SHARED
}

function getAggregateShareStatus(
  blocks: Array<CustomBlock>,
  blockInfoMap: Map<string, BlockShareInfo<CampaignMemberId>>,
  hasCompleteData: boolean,
): AggregateShareStatus {
  if (!hasCompleteData || blocks.length === 0) return AGGREGATE_SHARE_STATUS.NOT_SHARED

  const statuses = blocks.map((block) => getBlockShareStatus(block, blockInfoMap))

  if (statuses.every((status) => status === SHARE_STATUS.NOT_SHARED)) {
    return AGGREGATE_SHARE_STATUS.NOT_SHARED
  }
  if (statuses.every((status) => status === SHARE_STATUS.ALL_SHARED)) {
    return AGGREGATE_SHARE_STATUS.ALL_SHARED
  }
  if (statuses.every((status) => status === SHARE_STATUS.INDIVIDUALLY_SHARED)) {
    return AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED
  }
  return AGGREGATE_SHARE_STATUS.MIXED_SHARED
}

function getShareState(
  blocks: Array<CustomBlock>,
  blockInfoMap: Map<string, BlockShareInfo<CampaignMemberId>>,
  memberId: CampaignMemberId,
): ShareState {
  if (blocks.length === 0) return 'none'

  const sharedBlocks = blocks.filter((block) =>
    isBlockSharedWithMember(block, blockInfoMap, memberId),
  )
  if (sharedBlocks.length === 0) return 'none'
  return sharedBlocks.length === blocks.length ? 'all' : 'some'
}

function isBlockSharedWithMember(
  block: CustomBlock,
  blockInfoMap: Map<string, BlockShareInfo<CampaignMemberId>>,
  memberId: CampaignMemberId,
) {
  const info = blockInfoMap.get(block.id)
  if (!info) return false

  return (
    info.shareStatus === SHARE_STATUS.ALL_SHARED ||
    (info.shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED &&
      info.sharedMemberIds.includes(memberId))
  )
}

function getBlocksToShareWithMember(
  blocks: Array<CustomBlock>,
  blockInfoMap: Map<string, BlockShareInfo<CampaignMemberId>>,
  memberId: CampaignMemberId,
) {
  return blocks.filter((block) => {
    const info = blockInfoMap.get(block.id)
    const status = info?.shareStatus ?? SHARE_STATUS.NOT_SHARED

    return (
      status === SHARE_STATUS.NOT_SHARED ||
      (status === SHARE_STATUS.INDIVIDUALLY_SHARED && !info?.sharedMemberIds.includes(memberId))
    )
  })
}
