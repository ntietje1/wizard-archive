import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const yjsSyncTables = {
  yjsUpdates: defineTable({
    documentId: v.id('notes'),
    update: v.bytes(),
    seq: v.number(),
    isSnapshot: v.boolean(),
  }).index('by_document_seq', ['documentId', 'seq']),

  yjsAwareness: defineTable({
    documentId: v.id('notes'),
    clientId: v.number(),
    userId: v.id('userProfiles'),
    state: v.bytes(),
    updatedAt: v.number(),
  })
    .index('by_document', ['documentId'])
    .index('by_document_client', ['documentId', 'clientId'])
    .index('by_updatedAt', ['updatedAt']),
}
