import { requireItemAccess } from '../../sidebarItems/validation/access'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { isYjsDocumentType } from './yjsDocumentTypes'
import type { CampaignQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../../shared/common/ids'

async function checkYjsAccess(
  ctx: CampaignQueryCtx,
  documentId: SidebarItemId,
  requiredLevel: (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL],
) {
  const doc = await getSidebarItem(ctx, documentId)
  if (!doc) throwClientError(ERROR_CODE.NOT_FOUND, 'Document not found')
  if (!isYjsDocumentType(doc.type)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Document type does not support Yjs sync')
  }
  if (doc.status !== RESOURCE_STATUS.active) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Document is not active')
  }
  await requireItemAccess(ctx, {
    rawItem: doc,
    requiredLevel,
  })
  return doc
}

export async function checkYjsReadAccess(ctx: CampaignQueryCtx, documentId: SidebarItemId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.VIEW)
}

export async function checkYjsWriteAccess(ctx: CampaignQueryCtx, documentId: SidebarItemId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.EDIT)
}
