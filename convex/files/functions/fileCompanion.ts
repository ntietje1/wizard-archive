import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFileCompanion(
  ctx: CampaignMutationCtx,
  {
    fileId,
  }: {
    fileId: Id<'sidebarItems'>
  },
): Promise<void> {
  await ctx.db.insert('files', {
    sidebarItemId: fileId,
    storageId: null,
  })

  await logEditHistory(ctx, {
    itemId: fileId,
    itemType: RESOURCE_TYPES.files,
    action: EDIT_HISTORY_ACTION.created,
  })
}

export async function copyFileCompanion(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const targetItem = await ctx.db.get('sidebarItems', targetItemId)
  if (!targetItem) throwClientError(ERROR_CODE.NOT_FOUND, 'File target item not found')
  if (targetItem.type !== RESOURCE_TYPES.files) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'File companion requires a file item')
  }
  const existingFile = await ctx.db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', targetItemId))
    .unique()
  if (existingFile) {
    throwClientError(ERROR_CODE.CONFLICT, 'File companion already exists')
  }
  const sourceFile = await ctx.db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sourceItemId))
    .unique()
  if (!sourceFile) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Missing file companion for sidebar item ${sourceItemId}`,
    )
  }
  if (sourceFile.storageId) {
    const storageObject = await ctx.db.system.get('_storage', sourceFile.storageId)
    if (!storageObject) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Source file storage blob not found')
    }
  }
  await ctx.db.insert('files', {
    sidebarItemId: targetItemId,
    storageId: sourceFile.storageId,
  })
}
