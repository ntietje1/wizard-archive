import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

export const yjsDocumentIdValidator = v.id('sidebarItems')

const yjsUpdateFields = {
  documentId: yjsDocumentIdValidator,
  update: v.bytes(),
  seq: v.number(),
  isSnapshot: v.boolean(),
}

export const yjsSyncTables = {
  yjsUpdates: defineTable(yjsUpdateFields).index('by_document_seq', ['documentId', 'seq']),

  yjsDocumentStates: defineTable({
    documentId: yjsDocumentIdValidator,
    revision: v.number(),
  }).index('by_document', ['documentId']),

  yjsAwareness: defineTable({
    documentId: yjsDocumentIdValidator,
    clientId: v.number(),
    userId: v.id('userProfiles'),
    leaseId: v.string(),
    state: v.bytes(),
    updatedAt: v.number(),
  })
    .index('by_document', ['documentId'])
    .index('by_document_client', ['documentId', 'clientId'])
    .index('by_updatedAt', ['updatedAt']),
}

export const yjsUpdateValidator = v.object({
  ...convexValidatorFields('yjsUpdates'),
  ...yjsUpdateFields,
})
