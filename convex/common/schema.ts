import { v } from 'convex/values'

export const commonTableFields = {
  updatedTime: v.union(v.number(), v.null()),
  updatedBy: v.union(v.id('userProfiles'), v.null()),
  createdBy: v.id('userProfiles'),
  deletionTime: v.union(v.number(), v.null()),
  deletedBy: v.union(v.id('userProfiles'), v.null()),
}

export const convexValidatorFields = (tableName: string) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
})

export const commonValidatorFields = (tableName: string) => ({
  ...convexValidatorFields(tableName),
  ...commonTableFields,
})
