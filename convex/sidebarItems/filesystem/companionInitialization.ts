import { createCanvasCompanion } from '../../canvases/functions/canvasCompanion'
import { assertNever } from '../../common/types'
import { createFileCompanion } from '../../files/functions/fileCompanion'
import { createFolderCompanion } from '../../folders/functions/folderCompanion'
import { createMapCompanion } from '../../gameMaps/functions/mapCompanion'
import { createNoteCompanion } from '../../notes/functions/noteCompanion'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { SidebarItemType } from '../types/baseTypes'

export async function initializeEmptySidebarItemCompanion(
  ctx: CampaignMutationCtx,
  {
    itemId,
    itemType,
  }: {
    itemId: Id<'sidebarItems'>
    itemType: SidebarItemType
  },
) {
  switch (itemType) {
    case SIDEBAR_ITEM_TYPES.notes:
      await createNoteCompanion(ctx, { noteId: itemId })
      return
    case SIDEBAR_ITEM_TYPES.folders:
      await createFolderCompanion(ctx, { folderId: itemId })
      return
    case SIDEBAR_ITEM_TYPES.gameMaps:
      await createMapCompanion(ctx, { mapId: itemId })
      return
    case SIDEBAR_ITEM_TYPES.files:
      await createFileCompanion(ctx, { fileId: itemId })
      return
    case SIDEBAR_ITEM_TYPES.canvases:
      await createCanvasCompanion(ctx, { canvasId: itemId })
      return
    default:
      assertNever(itemType)
  }
}
