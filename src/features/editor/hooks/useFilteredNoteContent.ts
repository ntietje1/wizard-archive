import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SHARE_STATUS } from 'convex/blockShares/types'

import type { BlockMeta, NoteWithContent } from 'convex/notes/types'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { assertNever } from '~/shared/utils/utils'

function canViewBlock(
  meta: BlockMeta,
  viewAsPlayerId: Id<'campaignMembers'>,
): boolean {
  switch (meta.shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return true
    case SHARE_STATUS.INDIVIDUALLY_SHARED:
      return meta.sharedWith.includes(viewAsPlayerId)
    case SHARE_STATUS.NOT_SHARED:
      return false
    default:
      return assertNever(meta.shareStatus)
  }
}

/**
 * Returns filtered note content and whether block filtering is active.
 *
 * - EDIT+ access: all blocks, isViewOnly=false
 * - VIEW access (DM view-as): filtered by shareStatus, isViewOnly=true
 * - VIEW access (player): filtered by myPermissionLevel, isViewOnly=true
 */
export function useFilteredNoteContent(note: NoteWithContent): {
  content: Array<CustomBlock>
  isViewOnly: boolean
} {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap } = useActiveSidebarItems()

  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  if (effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, permOpts)) {
    return { content: note.content, isViewOnly: false }
  }

  // View-only: filter blocks based on context
  if (isDm && viewAsPlayerId) {
    // DM view-as: use block shareStatus to determine visibility for viewed player
    return {
      content: note.content.filter((block) => {
        const meta = note.blockMeta[block.id]
        if (!meta) return true
        return canViewBlock(meta, viewAsPlayerId)
      }),
      isViewOnly: true,
    }
  }

  // Regular player: use backend-computed myPermissionLevel per block
  return {
    content: note.content.filter((block) => {
      const meta = note.blockMeta[block.id]
      if (!meta) return true
      return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
    }),
    isViewOnly: true,
  }
}
