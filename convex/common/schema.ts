import { v } from 'convex/values'

// includes _id and _creationTime for use in validators
export const commonMetaFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
  updatedAt: v.number(),
  createdBy: v.id('campaignMembers'),
})
