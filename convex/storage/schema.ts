import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const fileStorageTableFields = {
  storageId: v.id('_storage'),
  userId: v.id('userProfiles'),
  status: v.union(v.literal('uncommitted'), v.literal('committed')),
  updatedAt: v.number(),
  originalFileName: v.optional(v.string()),
}

export const fileStorageTables = {
  fileStorage: defineTable({
    ...fileStorageTableFields,
  })
    .index('by_user_storage', ['userId', 'storageId'])
    .index('by_status', ['status']),
}
