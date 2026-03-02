import { v } from 'convex/values'

export const commonTableFields = {
  updatedTime: v.number(),
  updatedBy: v.id('userProfiles'), // TODO: make updated fields optional
  createdBy: v.id('userProfiles'),
  deletionTime: v.optional(v.number()),
  deletedBy: v.optional(v.id('userProfiles')),
}

export const convexValidatorFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
})

export const commonValidatorFields = (tableName: string) => ({
  ...convexValidatorFields(tableName),
  ...commonTableFields,
})
