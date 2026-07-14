import { v } from 'convex/values'
import { campaignInternalQuery, dmInternalQuery } from '../functions'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { CampaignQueryCtx } from '../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { resourceIdValidator } from '../resources/validators'

function assertNoteItem(item: { type: string }) {
  if (item.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note projection requires a note item')
  }
}

async function requireNoteWriteAccessForMember(ctx: CampaignQueryCtx, documentId: ResourceId) {
  const providerDocumentId = await checkYjsWriteAccess(ctx, documentId)
  const item = await ctx.db.get('sidebarItems', providerDocumentId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  assertNoteItem(item)
  return { campaignMemberId: ctx.membership._id, documentId: providerDocumentId }
}

const noteWriteAccessArgs = {
  documentId: resourceIdValidator,
}

const noteWriteAccessReturns = v.object({
  campaignMemberId: v.id('campaignMembers'),
  documentId: v.id('sidebarItems'),
})

const noteWriteAccessHandler = async (
  ctx: CampaignQueryCtx,
  { documentId }: { documentId: ResourceId },
) => await requireNoteWriteAccessForMember(ctx, documentId)

export const requireNoteWriteAccess = campaignInternalQuery({
  args: noteWriteAccessArgs,
  returns: noteWriteAccessReturns,
  handler: noteWriteAccessHandler,
})

export const requireNoteDmWriteAccess = dmInternalQuery({
  args: noteWriteAccessArgs,
  returns: noteWriteAccessReturns,
  handler: noteWriteAccessHandler,
})
