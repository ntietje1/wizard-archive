import { requireItemAccess } from '../../sidebarItems/validation/access'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { YjsDocumentId } from '../../../shared/yjs-sync/types'

async function checkYjsAccess(
  ctx: CampaignQueryCtx,
  documentId: YjsDocumentId,
  requiredLevel: (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL],
) {
  const doc = await getSidebarItem(ctx, documentId)
  if (!doc) throwClientError(ERROR_CODE.NOT_FOUND, 'Document not found')
  await requireItemAccess(ctx, {
    rawItem: doc,
    requiredLevel,
  })
  return doc
}

export async function checkYjsReadAccess(ctx: CampaignQueryCtx, documentId: YjsDocumentId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.VIEW)
}

export async function checkYjsWriteAccess(ctx: CampaignQueryCtx, documentId: YjsDocumentId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.EDIT)
}
