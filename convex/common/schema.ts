import { v } from 'convex/values'

export const commonTableFields = {
  updatedTime: v.number(),
  updatedBy: v.id('userProfiles'),
  createdBy: v.id('userProfiles'),

  // TODO: add deleteStatus (deleted, archived, undefined)
}

export const convexValidatorFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
})

export const commonValidatorFields = (tableName: string) => ({
  ...convexValidatorFields(tableName),
  ...commonTableFields,
})
