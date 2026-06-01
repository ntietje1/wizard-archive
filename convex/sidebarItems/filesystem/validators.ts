import { v } from 'convex/values'
import { sidebarItemTableFields } from '../schema/sidebarItemFields'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
  sidebarItemStatusValidator,
  sidebarItemTypeValidator,
} from '../schema/validators'
import { FILE_SYSTEM_COMMAND_TYPE } from '../../../shared/sidebar-items/filesystem/commands'
import { FILE_SYSTEM_EVENT_TYPE } from '../../../shared/sidebar-items/filesystem/receipts'
import { createParentTargetValidator } from '../validation/parent'

const createCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.create),
  itemType: sidebarItemTypeValidator,
  name: sidebarItemNameValidator,
  parentTarget: createParentTargetValidator,
  iconName: v.optional(sidebarItemIconNameValidator),
  color: v.optional(sidebarItemColorValidator),
})

const renameCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.rename),
  itemId: v.id('sidebarItems'),
  name: v.optional(sidebarItemNameValidator),
  iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
  color: v.optional(v.nullable(sidebarItemColorValidator)),
})

const moveCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.move),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const copyCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.copy),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const trashCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.trash),
  itemIds: v.array(v.id('sidebarItems')),
})

const restoreCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.restore),
  itemIds: v.array(v.id('sidebarItems')),
  targetParentId: v.nullable(v.id('sidebarItems')),
})

const deleteForeverCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.deleteForever),
  itemIds: v.array(v.id('sidebarItems')),
})

const emptyTrashCommandValidator = v.object({
  type: v.literal(FILE_SYSTEM_COMMAND_TYPE.emptyTrash),
})

export const fileSystemCommandValidator = v.union(
  createCommandValidator,
  renameCommandValidator,
  moveCommandValidator,
  copyCommandValidator,
  trashCommandValidator,
  restoreCommandValidator,
  deleteForeverCommandValidator,
  emptyTrashCommandValidator,
)

export const fileSystemOperationDecisionValidator = v.object({
  sourceItemId: v.id('sidebarItems'),
  action: v.union(v.literal('skip'), v.literal('replace'), v.literal('keepBoth')),
})

export const fileSystemEventValidator = v.union(
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.created),
    itemId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.updated),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.renamed),
    itemId: v.id('sidebarItems'),
    slug: v.string(),
    previousSlug: v.string(),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.copied),
    itemId: v.id('sidebarItems'),
    sourceItemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.moved),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.trashed),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.restored),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.replaced),
    itemId: v.id('sidebarItems'),
    sourceItemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.mergedFolder),
    itemId: v.id('sidebarItems'),
    sourceItemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.deletedForever),
    itemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.skipped),
    itemId: v.id('sidebarItems'),
    sourceItemId: v.id('sidebarItems'),
  }),
  v.object({
    type: v.literal(FILE_SYSTEM_EVENT_TYPE.noop),
    itemId: v.id('sidebarItems'),
  }),
)

const fileSystemSummaryValidator = v.object({
  kind: v.union(
    v.literal('created'),
    v.literal('renamed'),
    v.literal('copied'),
    v.literal('moved'),
    v.literal('restored'),
    v.literal('trashed'),
    v.literal('deletedForever'),
    v.literal('noop'),
  ),
  affectedCount: v.number(),
  createdCount: v.number(),
  mergedCount: v.number(),
  skippedCount: v.number(),
})

const sidebarItemSnapshotValidator = v.object({
  _id: v.id('sidebarItems'),
  _creationTime: v.number(),
  ...sidebarItemTableFields,
})

const sidebarItemPatchCommonFields = {
  name: v.optional(sidebarItemNameValidator),
  slug: v.optional(sidebarItemSlugValidator),
  iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
  color: v.optional(v.nullable(sidebarItemColorValidator)),
  parentId: v.optional(v.nullable(v.id('sidebarItems'))),
  status: v.optional(sidebarItemStatusValidator),
  previewStorageId: v.optional(v.nullable(v.id('_storage'))),
  previewLockedUntil: v.optional(v.nullable(v.number())),
  previewClaimToken: v.optional(v.nullable(v.string())),
  previewUpdatedAt: v.optional(v.nullable(v.number())),
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

export const fileSystemPatchValidator = v.union(
  v.object({
    type: v.literal('upsertSidebarItem'),
    item: sidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateSidebarItem'),
    itemId: v.id('sidebarItems'),
    before: sidebarItemPatchPreconditionValidator,
    fields: sidebarItemPatchFieldsValidator,
  }),
  v.object({
    type: v.literal('removeSidebarItem'),
    itemId: v.id('sidebarItems'),
    snapshot: sidebarItemSnapshotValidator,
  }),
)

export const fileSystemChangeValidator = v.union(
  v.object({
    type: v.literal('insertSidebarItem'),
    itemId: v.id('sidebarItems'),
    after: sidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('updateSidebarItem'),
    itemId: v.id('sidebarItems'),
    before: sidebarItemSnapshotValidator,
    after: sidebarItemSnapshotValidator,
  }),
  v.object({
    type: v.literal('removeSidebarItem'),
    itemId: v.id('sidebarItems'),
    before: sidebarItemSnapshotValidator,
  }),
)

export const fileSystemTransactionReceiptValidator = v.object({
  transactionId: v.nullable(v.id('filesystemTransactions')),
  direction: v.union(v.literal('forward'), v.literal('undo'), v.literal('redo')),
  command: fileSystemCommandValidator,
  events: v.array(fileSystemEventValidator),
  patches: v.array(fileSystemPatchValidator),
  summary: fileSystemSummaryValidator,
  undoable: v.boolean(),
})
