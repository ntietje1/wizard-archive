import { v } from 'convex/values'

export const commonTableFields = {
  _updatedTime: v.number(),
  _updatedBy: v.id('userProfiles'),
  _createdBy: v.id('userProfiles'),

  // TODO: add deleteStatus (deleted, archived, undefined)
}

export const commonValidatorFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
  ...commonTableFields,
})
