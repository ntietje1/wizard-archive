// import { v } from 'convex/values'
// import { mutation } from '../_generated/server'
// import {
//   deleteTagAndCleanupContent,
//   getTag,
//   insertTagAndNote,
// } from '../tags/tags'
// import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
// import { requireCampaignMembership } from '../campaigns/campaigns'
// import { Id } from '../_generated/dataModel'
// import { createTagAndNoteArgs } from '../tags/schema'
// import { getShare } from './shares'

// // export const updateShared = mutation({
// //   args: {
// //     shareId: v.id('shares'),
// //   },
// //   returns: v.id('shares'),
// //   handler: async (ctx, args): Promise<Id<'shares'>> => {
// //     const share = await getShare(ctx, args.shareId)
// //     if (!share) {
// //       throw new Error('Share not found')
// //     }

// //     await requireCampaignMembership(
// //       ctx,
// //       { campaignId: share.campaignId },
// //       { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
// //     )

// //     await ctx.db.patch(args.shareId, {
// //       // put shares specific fields here
// //     })

// //     return args.shareId
// //   },
// // })

// export const deleteShare = mutation({
//   args: {
//     shareId: v.id('shares'),
//   },
//   returns: v.id('shares'),
//   handler: async (ctx, args): Promise<Id<'shares'>> => {
//     const share = await getShare(ctx, args.shareId)
//     if (!share) {
//       throw new Error('Share not found')
//     }

//     await requireCampaignMembership(
//       ctx,
//       { campaignId: share.campaignId },
//       { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
//     )

//     await deleteTagAndCleanupContent(ctx, share.tagId)
//     await ctx.db.delete(args.shareId)

//     return args.shareId
//   },
// })
