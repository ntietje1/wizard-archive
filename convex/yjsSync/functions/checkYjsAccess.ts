import { requireItemAccess } from '../../sidebarItems/validation'
import { requireCampaignMembership } from '../../functions'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

async function checkYjsAccess(
  ctx: AuthQueryCtx,
  documentId: Id<'notes'>,
  requiredLevel: (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL],
) {
  const note = await ctx.db.get(documentId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel,
  })
  return note
}

export async function checkYjsReadAccess(
  ctx: AuthQueryCtx,
  documentId: Id<'notes'>,
) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.VIEW)
}

export async function checkYjsWriteAccess(
  ctx: AuthQueryCtx,
  documentId: Id<'notes'>,
) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.EDIT)
}

// lighter check for hot mutation path
export async function checkYjsMembership(
  ctx: AuthQueryCtx,
  documentId: Id<'notes'>,
) {
  const note = await ctx.db.get(documentId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireCampaignMembership(ctx, note.campaignId)
  return note
}
