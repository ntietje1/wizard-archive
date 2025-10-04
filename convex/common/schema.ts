import { v } from 'convex/values'

export const commonMetaFields = {
  updatedAt: v.number(),
  createdBy: v.id('campaignMembers'),
}
