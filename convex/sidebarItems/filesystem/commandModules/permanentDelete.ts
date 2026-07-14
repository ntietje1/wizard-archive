import { createFileSystemWriteSession, deletedForeverEvent } from '../deltas'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import type { CampaignMutationCtx } from '../../../functions'
import type { StoredResourceDelta, StoredResourcePatchRow } from '../deltas'

type PermanentDeleteFileSystemCommand = Extract<
  ResourceCommand,
  { type: 'deleteForever' | 'emptyTrash' }
>

export async function buildPermanentDeleteDelta(
  ctx: CampaignMutationCtx,
  command: PermanentDeleteFileSystemCommand,
  rootItems: Array<StoredResourcePatchRow>,
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)

  for (const item of rootItems) {
    await session.deleteSidebarTree(item)
  }

  return await session.build({
    command,
    events: rootItems.map(deletedForeverEvent),
    undoable: false,
  })
}
