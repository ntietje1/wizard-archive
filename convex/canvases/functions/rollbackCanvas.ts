import { ERROR_CODE, throwClientError } from '../../errors'
import { rollbackYjsDocument } from '../../yjsSync/functions/rollbackYjsDocument'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Id } from '../../_generated/dataModel'

export async function rollbackCanvas(
  ctx: AuthMutationCtx,
  itemId: SidebarItemId,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const canvas = await ctx.db.get(itemId)
  if (!canvas) throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')

  await rollbackYjsDocument(ctx, itemId as Id<'canvases'>, snapshotData)
}
