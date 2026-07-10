import {
  getBlockAllPlayersPermissionLevel,
  getEffectiveBlockVisibilityPermissionLevel,
} from '../../../../shared/permissions/block-visibility'
import { hasPermissionForRequirement } from '../../../../shared/permissions/requirements'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import type { CampaignMemberId } from '../../../../shared/common/ids'
import type { NoteBlock } from './document/model'
import type { BlockMeta, NoteItemWithContent } from '../notes/item-contract'
import type { PermissionLevel } from '../../../../shared/permissions/types'

export function getVisibleNoteBlocks(
  note: NoteItemWithContent,
  {
    getMemberItemPermissionLevel,
    viewAsPlayerId,
  }: {
    getMemberItemPermissionLevel: (
      note: NoteItemWithContent,
      memberId: CampaignMemberId,
    ) => PermissionLevel
    viewAsPlayerId: CampaignMemberId | undefined
  },
): Array<NoteBlock> {
  if (viewAsPlayerId) {
    const notePermissionLevel = getMemberItemPermissionLevel(note, viewAsPlayerId)
    return filterVisibleBlocks(note.content, (block) => {
      const meta = note.blockMeta[block.id]
      if (!meta) return false
      return canViewBlockAsPlayer(meta, { viewAsPlayerId, notePermissionLevel })
    })
  }

  return filterVisibleBlocks(note.content, (block) => {
    const meta = note.blockMeta[block.id]
    return canViewNoteBlockInCurrentProjection(meta)
  })
}

function filterVisibleBlocks(
  blocks: ReadonlyArray<NoteBlock>,
  canViewBlock: (block: NoteBlock) => boolean,
): Array<NoteBlock> {
  return blocks.flatMap((block) => {
    if (!canViewBlock(block)) return []
    if (!block.children || block.children.length === 0) return [block]

    const children = filterVisibleBlocks(block.children, canViewBlock)
    if (children.length === block.children.length) return [block]
    return [{ ...block, children }]
  })
}

export function canViewNoteBlockInCurrentProjection(meta: BlockMeta | undefined): boolean {
  if (!meta) return false
  return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
}

function canViewBlockAsPlayer(
  meta: BlockMeta,
  {
    viewAsPlayerId,
    notePermissionLevel,
  }: {
    viewAsPlayerId: CampaignMemberId
    notePermissionLevel: PermissionLevel
  },
): boolean {
  const permissionLevel = getEffectiveBlockVisibilityPermissionLevel({
    isDm: false,
    notePermissionLevel,
    allPlayersPermissionLevel: getBlockAllPlayersPermissionLevel(meta.shareStatus),
    memberPermissionLevel: getMemberBlockVisibilityPermissionLevel(meta, viewAsPlayerId),
  })
  return hasPermissionForRequirement(permissionLevel, PERMISSION_LEVEL.VIEW)
}

function getMemberBlockVisibilityPermissionLevel(
  meta: BlockMeta,
  viewAsPlayerId: CampaignMemberId,
): PermissionLevel | null {
  if ((meta.hiddenFrom ?? []).includes(viewAsPlayerId)) return PERMISSION_LEVEL.NONE
  if (meta.sharedWith.includes(viewAsPlayerId)) return PERMISSION_LEVEL.VIEW
  return null
}
