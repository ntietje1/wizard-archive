import { asyncMap } from 'convex-helpers'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import {
  getActiveBlockSharePlayerMemberIds,
  getBlockSharePlayerNoteAccess,
} from '../../blockShares/functions/noteBlockShareEligibility'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { hasPermissionForRequirement } from '../../../shared/permissions/requirements'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { CampaignQueryCtx } from '../../functions'
import type {
  BlockMeta,
  BlockShareAccessWarning,
  NoteItem,
  NoteItemRow,
  NoteItemWithContent,
} from '@wizard-archive/editor/notes/item-contract'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemEnhancement } from '../../sidebarItems/functions/enhanceBaseSidebarItem'

export const enhanceNote = async (
  ctx: CampaignQueryCtx,
  { note, enhancement }: { note: NoteItemRow; enhancement?: SidebarItemEnhancement },
): Promise<NoteItem> => {
  return enhanceBase(ctx, { item: note, enhancement })
}

export const enhanceNoteWithContent = async (
  ctx: CampaignQueryCtx,
  { note }: { note: NoteItem },
): Promise<NoteItemWithContent> => {
  const [ancestors, allBlocks] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: note.parentId,
      isTrashed: note.isTrashed,
    }),
    getAllBlocksByNote(ctx, { noteId: note.id }),
  ])

  const isDm = ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM
  const permittedBlocks: Array<(typeof allBlocks)[number]> = []
  const blockMetaEntries = await asyncMap(allBlocks, async (block) => {
    const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED
    const [result, blockShares] = await Promise.all([
      enforceBlockSharePermissionsOrNull(ctx, {
        block,
        notePermissionLevel: note.myPermissionLevel,
      }),
      isDm || shareStatus !== SHARE_STATUS.NOT_SHARED ? getBlockSharesByBlock(ctx, { block }) : [],
    ])
    if (!result) return null
    const viewSharedMemberIds = isDm
      ? blockShares.flatMap((s) =>
          normalizeExplicitSharePermissionLevel(s.permissionLevel) === PERMISSION_LEVEL.VIEW
            ? [s.campaignMemberId]
            : [],
        )
      : []
    permittedBlocks.push(block)
    return {
      blockNoteId: block.blockNoteId,
      meta: {
        myPermissionLevel: result.permissionLevel,
        shareStatus,
        sharedWith: viewSharedMemberIds,
        hiddenFrom: isDm
          ? blockShares.flatMap((s) =>
              normalizeExplicitSharePermissionLevel(s.permissionLevel) === PERMISSION_LEVEL.NONE
                ? [s.campaignMemberId]
                : [],
            )
          : [],
      } satisfies BlockMeta,
      warningMemberIds: viewSharedMemberIds,
    }
  })
  const blockMeta: Record<string, BlockMeta> = {}
  const warningBlockCountsByMemberId = new Map<Id<'campaignMembers'>, number>()
  for (const entry of blockMetaEntries) {
    if (!entry) continue
    blockMeta[entry.blockNoteId] = entry.meta
    for (const memberId of entry.warningMemberIds) {
      warningBlockCountsByMemberId.set(
        memberId,
        (warningBlockCountsByMemberId.get(memberId) ?? 0) + 1,
      )
    }
  }
  const blockShareAccessWarnings = isDm
    ? await getBlockShareAccessWarnings(ctx, note, warningBlockCountsByMemberId)
    : []

  const content = reconstructBlockTree(permittedBlocks)
  return {
    ...note,
    content,
    blockMeta,
    blockShareAccessWarnings,
    ancestors,
  }
}

async function getBlockShareAccessWarnings(
  ctx: CampaignQueryCtx,
  note: NoteItem,
  blockCountsByMemberId: Map<Id<'campaignMembers'>, number>,
): Promise<Array<BlockShareAccessWarning>> {
  const memberIds = [...blockCountsByMemberId.keys()]
  if (memberIds.length === 0) return []

  const noteAccessRows = await getBlockSharePlayerNoteAccess(ctx, {
    note,
    candidateMemberIds: memberIds,
  })
  const activePlayerMemberIds = await getActiveBlockSharePlayerMemberIds(ctx, {
    note,
    candidateMemberIds: memberIds,
  })

  return noteAccessRows.flatMap((row) => {
    if (!activePlayerMemberIds.has(row.memberId)) return []
    if (hasPermissionForRequirement(row.notePermissionLevel, PERMISSION_LEVEL.VIEW)) return []
    const blockCount = blockCountsByMemberId.get(row.memberId)
    return blockCount === undefined ? [] : [{ campaignMemberId: row.memberId, blockCount }]
  })
}
