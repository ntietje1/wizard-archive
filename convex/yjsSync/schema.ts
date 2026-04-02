import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const yjsDocumentIdValidator = v.union(v.id('notes'), v.id('canvases'))

export const yjsSyncTables = {
  yjsUpdates: defineTable({
    documentId: yjsDocumentIdValidator,
    update: v.bytes(),
    seq: v.number(),
    isSnapshot: v.boolean(),
  }).index('by_document_seq', ['documentId', 'seq']),

  yjsAwareness: defineTable({
    documentId: yjsDocumentIdValidator,
    clientId: v.number(),
    userId: v.id('userProfiles'),
    state: v.bytes(),
    updatedAt: v.number(),
  })
    .index('by_document', ['documentId'])
    .index('by_document_client', ['documentId', 'clientId'])
    .index('by_updatedAt', ['updatedAt']),
}
