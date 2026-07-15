import { v } from 'convex/values'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { internalQuery } from '../_generated/server'
import { authenticate, checkCampaignMembership } from '../functions'
import { findCampaignRow } from '../campaigns/functions/campaignIdentity'

export const prepareFileResourceCreation = internalQuery({
  args: {
    campaignId: v.string(),
    uploadSessionId: v.id('fileStorage'),
  },
  returns: v.object({
    campaignId: v.id('campaigns'),
    originalFileName: v.string(),
    storageId: v.id('_storage'),
  }),
  handler: async (ctx, args) => {
    const user = await authenticate(ctx)
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, args.campaignId)
    const campaign = await findCampaignRow(ctx, campaignId)
    if (!campaign) throw new TypeError('Campaign is unavailable')
    await checkCampaignMembership({ ...ctx, user }, campaign._id)
    const upload = await ctx.db.get('fileStorage', args.uploadSessionId)
    if (
      !upload ||
      upload.userId !== user.profile._id ||
      upload.storageId === null ||
      upload.originalFileName === null
    ) {
      throw new TypeError('Upload session is unavailable')
    }
    return {
      campaignId: campaign._id,
      originalFileName: upload.originalFileName,
      storageId: upload.storageId,
    }
  },
})
