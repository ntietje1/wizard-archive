import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { permissionLevelValidator } from './validators'
import { sidebarItemTableFields } from './sidebarItemFields'
import {
  fileSystemCommandValidator,
  fileSystemEventValidator,
  fileSystemPatchValidator,
} from '../filesystem/validators'
import { sidebarItemShareValidator } from '../../sidebarShares/schema'
import { convexValidatorFields } from '../../common/schema'

export const sidebarItemValidatorFields = {
  ...convexValidatorFields('sidebarItems'),
  ...sidebarItemTableFields,
  shares: v.array(sidebarItemShareValidator),
  isBookmarked: v.boolean(),
  myPermissionLevel: permissionLevelValidator,
  previewUrl: v.nullable(v.string()),
  isActive: v.boolean(),
  isTrashed: v.boolean(),
}

const extensionBaseFields = {
  sidebarItemId: v.id('sidebarItems'),
}

export const sidebarItemsTables = {
  sidebarItems: defineTable(sidebarItemTableFields)
    .index('by_campaign_status_parent_name_deletionTime', [
      'campaignId',
      'status',
      'parentId',
      'name',
      'deletionTime',
    ])
    .index('by_campaign_status_deletionTime', ['campaignId', 'status', 'deletionTime'])
    .index('by_campaign_slug', ['campaignId', 'slug', 'deletionTime'])
    .index('by_campaign_deletionTime', ['campaignId', 'deletionTime'])
    .index('by_previewStorageId', ['previewStorageId']),

  notes: defineTable({
    ...extensionBaseFields,
  }).index('by_sidebarItemId', ['sidebarItemId']),

  folders: defineTable({
    ...extensionBaseFields,
    inheritShares: v.boolean(),
  }).index('by_sidebarItemId', ['sidebarItemId']),

  gameMaps: defineTable({
    ...extensionBaseFields,
    imageStorageId: v.nullable(v.id('_storage')),
  })
    .index('by_sidebarItemId', ['sidebarItemId'])
    .index('by_imageStorageId', ['imageStorageId']),

  files: defineTable({
    ...extensionBaseFields,
    storageId: v.nullable(v.id('_storage')),
  })
    .index('by_sidebarItemId', ['sidebarItemId'])
    .index('by_storageId', ['storageId']),

  canvases: defineTable({
    ...extensionBaseFields,
  }).index('by_sidebarItemId', ['sidebarItemId']),

  filesystemTransactions: defineTable({
    campaignId: v.id('campaigns'),
    actorMemberId: v.id('campaignMembers'),
    clientOperationId: v.nullable(v.string()),
    requestFingerprint: v.string(),
    command: fileSystemCommandValidator,
    events: v.array(fileSystemEventValidator),
    receiptPatches: v.array(fileSystemPatchValidator),
    forwardPatches: v.array(fileSystemPatchValidator),
    inversePatches: v.array(fileSystemPatchValidator),
    undoable: v.boolean(),
  })
    .index('by_campaign_actor', ['campaignId', 'actorMemberId'])
    .index('by_campaign_actor_undoable', ['campaignId', 'actorMemberId', 'undoable'])
    .index('by_campaign_actor_clientOperationId', [
      'campaignId',
      'actorMemberId',
      'clientOperationId',
    ]),
}
