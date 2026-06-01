import { v } from 'convex/values'
import { campaignInternalQuery, dmInternalQuery } from '../functions'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { SIDEBAR_ITEM_TYPES } from '../../shared/sidebar-items/types'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'

function assertNoteItem(item: { type: string }) {
  if (item.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note projection requires a note item')
  }
}

export const requireNoteWriteAccess = campaignInternalQuery({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    const item = await checkYjsWriteAccess(ctx, documentId)
    assertNoteItem(item)
    return null
  },
})

export const requireNoteDmWriteAccess = dmInternalQuery({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.id('campaignMembers'),
  handler: async (ctx, { documentId }) => {
    const item = await checkYjsWriteAccess(ctx, documentId)
    assertNoteItem(item)
    return ctx.membership._id
  },
})
