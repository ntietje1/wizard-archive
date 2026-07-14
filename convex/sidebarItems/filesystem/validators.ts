import { v } from 'convex/values'
import { sidebarItemTableFields } from '../schema/sidebarItemFields'
import {
  permissionLevelValidator,
  sidebarItemStatusValidator,
  sidebarItemTypeValidator,
} from '../schema/validators'
import {
  RESOURCE_COMMAND_TYPE,
  RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import {
  setBlockMemberPermissionCommandValidator,
  setBlocksShareStatusCommandValidator,
} from '../../blockShares/commandValidators'
import { createParentTargetValidator } from '../validation/parent'
import { resourceShareIdValidator } from '../../sidebarShares/validators'
import { assetIdValidator, operationIdValidator } from '../../resources/validators'
import { campaignIdValidator, campaignMemberIdValidator } from '../../campaigns/schema'
import { sessionIdValidator } from '../../sessions/schema'

const createCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.create),
  itemType: sidebarItemTypeValidator,
  name: v.string(),
  parentTarget: createParentTargetValidator,
  iconName: v.optional(v.string()),
  color: v.optional(v.string()),
})

const renameCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.rename),
  itemId: v.id('sidebarItems'),
  name: v.optional(v.string()),
  iconName: v.optional(v.nullable(v.string())),
  color: v.optional(v.nullable(v.string())),
})

const moveCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.move),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const copyCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.copy),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const trashCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.trash),
  itemIds: v.array(v.id('sidebarItems')),
})

const restoreCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.restore),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const deleteForeverCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.deleteForever),
  itemIds: v.array(v.id('sidebarItems')),
})

const emptyTrashCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.emptyTrash),
})

const setResourceAudiencePermissionCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.setResourceAudiencePermission),
  itemIds: v.array(v.id('sidebarItems')),
  permissionLevel: v.nullable(permissionLevelValidator),
})

const setResourcesMemberPermissionCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.setResourcesMemberPermission),
  itemIds: v.array(v.id('sidebarItems')),
  campaignMemberId: campaignMemberIdValidator,
  permissionLevel: permissionLevelValidator,
})

const clearResourcesMemberPermissionCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission),
  itemIds: v.array(v.id('sidebarItems')),
  campaignMemberId: campaignMemberIdValidator,
})

const setFolderInheritSharesCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.setFolderInheritShares),
  folderId: v.id('sidebarItems'),
  inheritShares: v.boolean(),
})

const toggleBookmarksCommandValidator = v.object({
  type: v.literal(RESOURCE_COMMAND_TYPE.toggleBookmarks),
  itemIds: v.array(v.id('sidebarItems')),
})

const fileSystemCommandValidatorsByType = {
  [RESOURCE_COMMAND_TYPE.create]: createCommandValidator,
  [RESOURCE_COMMAND_TYPE.rename]: renameCommandValidator,
  [RESOURCE_COMMAND_TYPE.move]: moveCommandValidator,
  [RESOURCE_COMMAND_TYPE.copy]: copyCommandValidator,
  [RESOURCE_COMMAND_TYPE.trash]: trashCommandValidator,
  [RESOURCE_COMMAND_TYPE.restore]: restoreCommandValidator,
  [RESOURCE_COMMAND_TYPE.deleteForever]: deleteForeverCommandValidator,
  [RESOURCE_COMMAND_TYPE.emptyTrash]: emptyTrashCommandValidator,
  [RESOURCE_COMMAND_TYPE.setResourceAudiencePermission]:
    setResourceAudiencePermissionCommandValidator,
  [RESOURCE_COMMAND_TYPE.setResourcesMemberPermission]:
    setResourcesMemberPermissionCommandValidator,
  [RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission]:
    clearResourcesMemberPermissionCommandValidator,
  [RESOURCE_COMMAND_TYPE.setFolderInheritShares]: setFolderInheritSharesCommandValidator,
  [RESOURCE_COMMAND_TYPE.setBlocksShareStatus]: setBlocksShareStatusCommandValidator,
  [RESOURCE_COMMAND_TYPE.setBlockMemberPermission]: setBlockMemberPermissionCommandValidator,
  [RESOURCE_COMMAND_TYPE.toggleBookmarks]: toggleBookmarksCommandValidator,
} satisfies Record<ResourceCommand['type'], unknown>

export const fileSystemCommandValidator = v.union(
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.create],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.rename],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.move],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.copy],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.trash],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.restore],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.deleteForever],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.emptyTrash],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.setResourceAudiencePermission],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.setResourcesMemberPermission],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.setFolderInheritShares],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.setBlocksShareStatus],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.setBlockMemberPermission],
  fileSystemCommandValidatorsByType[RESOURCE_COMMAND_TYPE.toggleBookmarks],
)

export const fileSystemEventValidator = v.union(
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.created),
    itemId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.updated),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.renamed),
    itemId: v.id('sidebarItems'),
    slug: v.string(),
    previousSlug: v.string(),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.copied),
    itemId: v.id('sidebarItems'),
    sourceItemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.moved),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.trashed),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.restored),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.deletedForever),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(RESOURCE_EVENT_TYPE.noop),
    itemId: v.id('sidebarItems'),
  }),
)

const fileSystemSummaryValidator = v.object({
  kind: v.union(
    v.literal('created'),
    v.literal('updated'),
    v.literal('renamed'),
    v.literal('copied'),
    v.literal('moved'),
    v.literal('restored'),
    v.literal('trashed'),
    v.literal('deletedForever'),
    v.literal('shared'),
    v.literal('bookmarksUpdated'),
    v.literal('noop'),
  ),
  affectedCount: v.number(),
  createdCount: v.number(),
})

const sidebarItemSnapshotValidator = v.object({
  id: v.id('sidebarItems'),
  createdAt: v.number(),
  name: v.string(),
  slug: v.string(),
  parentId: v.nullable(v.id('sidebarItems')),
  workspaceId: v.id('campaigns'),
  type: sidebarItemTypeValidator,
  color: v.nullable(v.string()),
  iconName: v.nullable(v.string()),
  location: sidebarItemTableFields.location,
  status: sidebarItemStatusValidator,
  allPermissionLevel: sidebarItemTableFields.allPermissionLevel,
  updatedTime: sidebarItemTableFields.updatedTime,
  updatedBy: sidebarItemTableFields.updatedBy,
  createdBy: sidebarItemTableFields.createdBy,
  deletionTime: sidebarItemTableFields.deletionTime,
  deletedBy: sidebarItemTableFields.deletedBy,
  previewAssetId: v.nullable(assetIdValidator),
})

const storedSidebarItemSnapshotValidator = v.object({
  _id: v.id('sidebarItems'),
  _creationTime: v.number(),
  ...sidebarItemTableFields,
})

const sidebarItemPatchCommonFields = {
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  iconName: v.optional(v.nullable(v.string())),
  color: v.optional(v.nullable(v.string())),
  parentId: v.optional(v.nullable(v.id('sidebarItems'))),
  status: v.optional(sidebarItemStatusValidator),
  allPermissionLevel: v.optional(v.nullable(permissionLevelValidator)),
  previewAssetId: v.optional(v.nullable(assetIdValidator)),
  updatedTime: v.optional(v.nullable(v.number())),
  updatedBy: v.optional(v.nullable(v.id('userProfiles'))),
  deletionTime: v.optional(v.nullable(v.number())),
  deletedBy: v.optional(v.nullable(v.id('userProfiles'))),
}

const sidebarItemPatchFieldsValidator = v.object(sidebarItemPatchCommonFields)

const sidebarItemPatchPreconditionValidator = v.object({
  ...sidebarItemPatchCommonFields,
  type: v.optional(sidebarItemTypeValidator),
  createdBy: v.optional(v.id('userProfiles')),
})

const sidebarItemShareSnapshotValidator = v.object({
  id: resourceShareIdValidator,
  createdAt: v.number(),
  workspaceId: campaignIdValidator,
  resourceId: v.id('sidebarItems'),
  sidebarItemType: sidebarItemTypeValidator,
  memberId: campaignMemberIdValidator,
  sessionId: v.nullable(sessionIdValidator),
  permissionLevel: v.nullable(permissionLevelValidator),
})

const storedSidebarItemShareSnapshotValidator = v.object({
  _id: v.id('sidebarItemShares'),
  _creationTime: v.number(),
  resourceShareUuid: resourceShareIdValidator,
  campaignId: v.id('campaigns'),
  sidebarItemId: v.id('sidebarItems'),
  sidebarItemType: sidebarItemTypeValidator,
  campaignMemberId: v.id('campaignMembers'),
  sessionId: v.nullable(v.id('sessions')),
  permissionLevel: v.nullable(permissionLevelValidator),
})

const sidebarItemSharePatchFieldsValidator = v.object({
  permissionLevel: v.nullable(permissionLevelValidator),
})

const folderShareSnapshotValidator = v.object({
  folderId: v.id('sidebarItems'),
  inheritShares: v.boolean(),
})

const folderSharePatchFieldsValidator = v.object({
  inheritShares: v.boolean(),
})

const storedBookmarkStateChangeFields = {
  itemId: v.id('sidebarItems'),
  campaignMemberId: v.id('campaignMembers'),
  before: v.boolean(),
  after: v.boolean(),
}

const legacyBookmarkSnapshotValidator = v.object({
  _id: v.id('bookmarks'),
  _creationTime: v.number(),
  campaignId: v.id('campaigns'),
  sidebarItemId: v.id('sidebarItems'),
  campaignMemberId: v.id('campaignMembers'),
})

export const fileSystemPatchValidator = v.union(
  v.object({
    type: v.literal('upsertResource'),
    item: sidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateResource'),
    itemId: v.id('sidebarItems'),
    before: sidebarItemPatchPreconditionValidator,
    fields: sidebarItemPatchFieldsValidator,
  }),
  v.object({
    type: v.literal('removeResource'),
    itemId: v.id('sidebarItems'),
    snapshot: sidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('upsertResourceShare'),
    share: sidebarItemShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateResourceShare'),
    resourceId: v.id('sidebarItems'),
    memberId: campaignMemberIdValidator,
    before: sidebarItemSharePatchFieldsValidator,
    fields: sidebarItemSharePatchFieldsValidator,
  }),
  v.object({
    type: v.literal('removeResourceShare'),
    share: sidebarItemShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateFolderShare'),
    folderId: v.id('sidebarItems'),
    before: folderSharePatchFieldsValidator,
    fields: folderSharePatchFieldsValidator,
  }),
  v.object({
    type: v.literal('setResourceBookmarkState'),
    itemId: v.id('sidebarItems'),
    isBookmarked: v.boolean(),
  }),
)

export const fileSystemChangeValidator = v.union(
  v.object({
    type: v.literal('insertResource'),
    itemId: v.id('sidebarItems'),
    after: storedSidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateResource'),
    itemId: v.id('sidebarItems'),
    before: storedSidebarItemSnapshotValidator,
    after: storedSidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('removeResource'),
    itemId: v.id('sidebarItems'),
    before: storedSidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('insertResourceShare'),
    after: storedSidebarItemShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateResourceShare'),
    before: storedSidebarItemShareSnapshotValidator,
    after: storedSidebarItemShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('removeResourceShare'),
    before: storedSidebarItemShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateFolderShare'),
    before: folderShareSnapshotValidator,
    after: folderShareSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateResourceBookmarkState'),
    ...storedBookmarkStateChangeFields,
  }),
  v.object({
    type: v.literal('insertBookmark'),
    after: legacyBookmarkSnapshotValidator,
  }),
  v.object({
    type: v.literal('removeBookmark'),
    before: legacyBookmarkSnapshotValidator,
  }),
)

export const fileSystemTransactionReceiptValidator = v.object({
  transactionId: v.nullable(operationIdValidator),
  direction: v.union(v.literal('forward'), v.literal('undo'), v.literal('redo')),
  command: fileSystemCommandValidator,
  events: v.array(fileSystemEventValidator),
  patches: v.array(fileSystemPatchValidator),
  summary: fileSystemSummaryValidator,
  undoable: v.boolean(),
})
