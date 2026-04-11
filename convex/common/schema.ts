import { v } from 'convex/values'
import type { TableNames } from '../_generated/dataModel'

export const commonTableFields = {
  updatedTime: v.nullable(v.number()),
  updatedBy: v.nullable(v.id('userProfiles')),
  createdBy: v.id('userProfiles'),
  deletionTime: v.nullable(v.number()),
  deletedBy: v.nullable(v.id('userProfiles')),
}

export const convexValidatorFields = (tableName: TableNames) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
})

export const commonValidatorFields = (tableName: TableNames) => ({
  ...convexValidatorFields(tableName),
  ...commonTableFields,
})
