import { v } from 'convex/values'
import type { TableNames } from '../_generated/dataModel'

export const convexValidatorFields = (tableName: TableNames) => ({
  _id: v.id(tableName),
  _creationTime: v.number(),
})
