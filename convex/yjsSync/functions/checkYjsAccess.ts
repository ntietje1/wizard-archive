import { requireItemAccess } from '../../sidebarItems/validation/access'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { findSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'
import { isYjsDocumentType } from './yjsDocumentTypes'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

async function checkYjsAccess(
  ctx: CampaignQueryCtx,
  documentId: ResourceId,
  requiredLevel: (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL],
) {
  const providerRow = await findSidebarItemRow(ctx, documentId)
  const doc = providerRow ? await getSidebarItem(ctx, providerRow._id) : null
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
  return providerRow!._id
}

export async function checkYjsReadAccess(ctx: CampaignQueryCtx, documentId: ResourceId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.VIEW)
}

export async function checkYjsWriteAccess(ctx: CampaignQueryCtx, documentId: ResourceId) {
  return await checkYjsAccess(ctx, documentId, PERMISSION_LEVEL.EDIT)
}
