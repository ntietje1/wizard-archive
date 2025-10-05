import { v } from 'convex/values'

export const commonMetaFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
  updatedAt: v.number(),
  createdBy: v.id('campaignMembers'),
})