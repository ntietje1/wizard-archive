import { v } from 'convex/values'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { internalQuery } from '../_generated/server'
import { authenticate, checkDmMembership } from '../functions'
import { findCampaignRow } from '../campaigns/functions/campaignIdentity'

export const prepareFileUpload = internalQuery({
  args: {
    campaignId: v.string(),
    uploadSessionId: v.id('fileStorage'),
  },
  returns: v.object({
    campaignId: v.id('campaigns'),
    campaignUuid: v.string(),
    actorId: v.string(),
    originalFileName: v.string(),
    storageId: v.id('_storage'),
    byteSize: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await authenticate(ctx)
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, args.campaignId)
    const campaign = await findCampaignRow(ctx, campaignId)
    if (!campaign) throw new TypeError('Campaign is unavailable')
    const { membership } = await checkDmMembership({ ...ctx, user }, campaign._id)
    const upload = await ctx.db.get('fileStorage', args.uploadSessionId)
    if (
      !upload ||
      upload.userId !== user.profile._id ||
      upload.storageId === null ||
      upload.originalFileName === null
    ) {
      throw new TypeError('Upload session is unavailable')
    }
    const metadata = await ctx.db.system.get('_storage', upload.storageId)
    if (!metadata) throw new TypeError('Uploaded file bytes are unavailable')
    return {
      campaignId: campaign._id,
      campaignUuid: campaign.campaignUuid,
      actorId: membership.campaignMemberUuid,
      originalFileName: upload.originalFileName,
      storageId: upload.storageId,
      byteSize: metadata.size,
    }
  },
})
