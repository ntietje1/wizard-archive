import { createCanvasCompanion } from '../../canvases/functions/canvasCompanion'
import { assertNever } from '../../common/types'
import { createFileCompanion } from '../../files/functions/fileCompanion'
import { createFolderCompanion } from '../../folders/functions/folderCompanion'
import { createMapCompanion } from '../../gameMaps/functions/mapCompanion'
import { createNoteCompanion } from '../../notes/functions/noteCompanion'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-contract'

export async function initializeEmptySidebarItemCompanion(
  ctx: CampaignMutationCtx,
  {
    itemId,
    itemType,
  }: {
    itemId: Id<'sidebarItems'>
    itemType: ResourceKind
  },
) {
  switch (itemType) {
    case RESOURCE_TYPES.notes:
      await createNoteCompanion(ctx, { noteId: itemId })
      return
    case RESOURCE_TYPES.folders:
      await createFolderCompanion(ctx, { folderId: itemId })
      return
    case RESOURCE_TYPES.gameMaps:
      await createMapCompanion(ctx, { mapId: itemId })
      return
    case RESOURCE_TYPES.files:
      await createFileCompanion(ctx, { fileId: itemId })
      return
    case RESOURCE_TYPES.canvases:
      await createCanvasCompanion(ctx, { canvasId: itemId })
      return
    default:
      assertNever(itemType)
  }
}
