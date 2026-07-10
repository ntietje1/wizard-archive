import { v } from 'convex/values'
import { campaignInternalQuery, dmInternalQuery } from '../functions'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'

function assertNoteItem(item: { type: string }) {
  if (item.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note projection requires a note item')
  }
}

async function requireNoteWriteAccessForMember(
  ctx: CampaignQueryCtx,
  documentId: Id<'sidebarItems'>,
) {
  const item = await checkYjsWriteAccess(ctx, documentId)
  assertNoteItem(item)
  return ctx.membership._id
}

export const requireNoteWriteAccess = campaignInternalQuery({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.id('campaignMembers'),
  handler: async (ctx, { documentId }) => await requireNoteWriteAccessForMember(ctx, documentId),
})

export const requireNoteDmWriteAccess = dmInternalQuery({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.id('campaignMembers'),
  handler: async (ctx, { documentId }) => await requireNoteWriteAccessForMember(ctx, documentId),
})
