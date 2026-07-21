import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { RESOURCE_KIND } from '@wizard-archive/editor/resources/resource-record'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { PropertyValidators } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { campaignIdValidator, campaignMemberIdValidator } from '../campaigns/schema'
import {
  assetIdValidator,
  historyEntryIdValidator,
  importJobIdValidator,
  mapPinIdValidator,
  noteBlockIdValidator,
  operationIdValidator,
  resourceIdValidator,
  snapshotIdValidator,
} from './validators'
import {
  FILE_CLASSIFICATION,
  FILE_VIEWER_UNAVAILABLE_REASON,
} from '@wizard-archive/editor/resources/file-content-contract'
import {
  FOLDER_ACCESS_INHERITANCE,
  RESOURCE_PERMISSION,
} from '@wizard-archive/editor/resources/access-policy'
import { NOTE_BLOCK_VISIBILITY } from '@wizard-archive/editor/resources/note-block-access-policy'
import {
  ITEM_HISTORY_ACTION,
  ITEM_HISTORY_RESTORE_PROTOCOL_VERSION,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/content-session-contract'

export const versionStampValidator = v.object({
  scheme: v.literal(VERSION_SCHEME),
  revision: v.number(),
  digest: v.string(),
})

export const sourcePathAliasValidator = v.object({
  campaignId: campaignIdValidator,
  resourceId: resourceIdValidator,
  importJobId: importJobIdValidator,
  sourceRootId: v.string(),
  rawPath: v.string(),
  normalizedPath: v.string(),
})

export const plainTransferSourceDescriptorValidator = v.object({
  id: v.string(),
  kind: literals('directory', 'file', 'zip'),
  name: v.string(),
})

export const plainTransferManifestEntryValidator = v.union(
  v.object({
    sourceId: v.string(),
    path: v.string(),
    type: v.literal('directory'),
  }),
  v.object({
    sourceId: v.string(),
    path: v.string(),
    type: v.literal('file'),
    byteSize: v.number(),
  }),
)

export const plainTransferEntryOutcomeValidator = v.union(
  v.object({
    status: v.literal('pending'),
    sourceId: v.string(),
    sourcePath: v.string(),
  }),
  v.object({
    status: v.literal('completed'),
    sourceId: v.string(),
    sourcePath: v.string(),
    resourceId: resourceIdValidator,
    kind: literals(RESOURCE_KIND.folder, RESOURCE_KIND.note, RESOURCE_KIND.file),
  }),
  v.object({
    status: v.literal('rejected'),
    sourceId: v.string(),
    sourcePath: v.string(),
    reason: v.string(),
  }),
  v.object({
    status: v.literal('cancelled'),
    sourceId: v.string(),
    sourcePath: v.string(),
  }),
)

export const plainTransferReceiptValidator = v.object({
  jobId: importJobIdValidator,
  status: literals('reserved', 'running', 'settled'),
  entries: v.array(plainTransferEntryOutcomeValidator),
})

export const plainTransferPlanSnapshotValidator = v.union(
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: literals('reserved', 'running', 'settled'),
    jobId: importJobIdValidator,
    destinationParentId: v.nullable(resourceIdValidator),
    textFileHandling: literals('files', 'notes'),
    sources: v.array(plainTransferSourceDescriptorValidator),
    entries: v.array(
      v.object({
        id: resourceIdValidator,
        operationId: operationIdValidator,
        parentId: v.nullable(resourceIdValidator),
        title: v.string(),
        sourceEntryPath: v.string(),
        sourcePath: v.string(),
        alias: sourcePathAliasValidator,
        entryType: literals('directory', 'file'),
        declaredByteSize: v.number(),
        uploadSessionId: v.nullable(v.id('fileStorage')),
        explicit: v.boolean(),
        status: literals('pending', 'completed', 'rejected', 'cancelled'),
      }),
    ),
  }),
)

export const resourceKindValidator = literals(...Object.values(RESOURCE_KIND))
export const resourcePermissionValidator = literals(...Object.values(RESOURCE_PERMISSION))
export const resourcePreviewValidator = v.object({
  kind: resourceKindValidator,
  excerpt: v.string(),
  outline: v.array(
    v.object({
      blockId: noteBlockIdValidator,
      level: literals(1, 2, 3, 4, 5, 6),
      text: v.string(),
    }),
  ),
})
export const resourcePreviewStateValidator = v.union(
  v.object({
    status: v.literal('unavailable'),
    reason: literals('scope_unavailable', 'unauthorized', 'integrity_error'),
  }),
  v.object({
    status: v.literal('ready'),
    preview: resourcePreviewValidator,
  }),
)
const grantedResourcePermissionValidator = literals(
  RESOURCE_PERMISSION.view,
  RESOURCE_PERMISSION.edit,
)
const resourceAudienceAccessValidator = v.union(
  v.object({ state: v.literal('default') }),
  v.object({
    state: v.literal('explicit'),
    permission: resourcePermissionValidator,
  }),
)
export const folderAccessInheritanceValidator = literals(
  ...Object.values(FOLDER_ACCESS_INHERITANCE),
)

export const resourceAccessCommandValidator = v.union(
  v.object({
    type: v.literal('setAudienceAccess'),
    resourceIds: v.array(resourceIdValidator),
    permission: resourcePermissionValidator,
  }),
  v.object({
    type: v.literal('clearAudienceAccess'),
    resourceIds: v.array(resourceIdValidator),
  }),
  v.object({
    type: v.literal('setMemberAccess'),
    resourceIds: v.array(resourceIdValidator),
    memberId: campaignMemberIdValidator,
    permission: resourcePermissionValidator,
  }),
  v.object({
    type: v.literal('clearMemberAccess'),
    resourceIds: v.array(resourceIdValidator),
    memberId: campaignMemberIdValidator,
  }),
  v.object({
    type: v.literal('setFolderAccessInheritance'),
    folderId: resourceIdValidator,
    inheritance: folderAccessInheritanceValidator,
  }),
)

const resourceAccessReceiptValidator = v.object({
  campaignId: campaignIdValidator,
  operationId: operationIdValidator,
  resourceIds: v.array(resourceIdValidator),
})

export const resourceAccessCommandResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    receipt: resourceAccessReceiptValidator,
  }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_command',
      'ownership_mismatch',
      'unauthorized',
      'resource_missing',
      'invalid_resource_kind',
      'invalid_permission',
      'operation_id_reused',
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: literals('capability_not_supported', 'dependency_unavailable', 'scope_unavailable'),
  }),
)

export const noteBlockVisibilityValidator = literals(...Object.values(NOTE_BLOCK_VISIBILITY))

export const noteBlockAccessCommandValidator = v.union(
  v.object({
    type: v.literal('setNoteBlockAudienceAccess'),
    noteId: resourceIdValidator,
    blockIds: v.array(noteBlockIdValidator),
    shared: v.boolean(),
  }),
  v.object({
    type: v.literal('setNoteBlockMemberAccess'),
    noteId: resourceIdValidator,
    blockIds: v.array(noteBlockIdValidator),
    memberId: campaignMemberIdValidator,
    permission: literals(RESOURCE_PERMISSION.none, RESOURCE_PERMISSION.view),
  }),
  v.object({
    type: v.literal('clearNoteBlockMemberAccess'),
    noteId: resourceIdValidator,
    blockIds: v.array(noteBlockIdValidator),
    memberId: campaignMemberIdValidator,
  }),
)

const noteBlockAccessReceiptValidator = v.object({
  campaignId: campaignIdValidator,
  operationId: operationIdValidator,
  noteId: resourceIdValidator,
  blockIds: v.array(noteBlockIdValidator),
})

export const noteBlockAccessCommandResultValidator = v.union(
  v.object({ status: v.literal('completed'), receipt: noteBlockAccessReceiptValidator }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_command',
      'ownership_mismatch',
      'unauthorized',
      'note_missing',
      'block_missing',
      'content_corrupt',
      'invalid_permission',
      'version_exhausted',
      'operation_id_reused',
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: literals('capability_not_supported', 'dependency_unavailable', 'scope_unavailable'),
  }),
)

export const noteBlockAccessPresentationValidator = v.object({
  noteId: resourceIdValidator,
  blocks: v.array(
    v.object({
      blockId: noteBlockIdValidator,
      audienceVisibility: noteBlockVisibilityValidator,
      memberAccess: v.array(
        v.object({
          memberId: campaignMemberIdValidator,
          visibility: noteBlockVisibilityValidator,
        }),
      ),
    }),
  ),
  participants: v.array(
    v.object({
      id: campaignMemberIdValidator,
      displayName: v.string(),
      username: v.string(),
      imageUrl: v.nullable(v.string()),
      notePermission: resourcePermissionValidator,
    }),
  ),
})

export const noteBlockAccessPresentationPageValidator = v.object({
  presentation: v.nullable(noteBlockAccessPresentationValidator),
  cursor: v.nullable(v.string()),
})

const resourceAccessPolicyValidator = v.union(
  v.object({
    resourceId: resourceIdValidator,
    audienceAccess: resourceAudienceAccessValidator,
    subject: v.literal('folder'),
    inheritance: folderAccessInheritanceValidator,
  }),
  v.object({
    resourceId: resourceIdValidator,
    audienceAccess: resourceAudienceAccessValidator,
    subject: v.literal('resource'),
  }),
)

const resourceAccessResolutionValidator = v.object({
  permission: resourcePermissionValidator,
  source: v.union(
    v.object({
      type: v.union(v.literal('audience'), v.literal('member')),
      resourceId: resourceIdValidator,
    }),
    v.object({ type: v.literal('none') }),
  ),
})

export const resourceAccessPresentationValidator = v.object({
  policy: resourceAccessPolicyValidator,
  defaultAccess: resourceAccessResolutionValidator,
  participants: v.array(
    v.object({
      id: campaignMemberIdValidator,
      displayName: v.string(),
      username: v.string(),
      imageUrl: v.nullable(v.string()),
      access: v.union(
        v.object({ state: v.literal('default') }),
        v.object({
          state: v.literal('explicit'),
          permission: resourcePermissionValidator,
        }),
      ),
      effectiveAccess: resourceAccessResolutionValidator,
    }),
  ),
})

export const resourceAccessPresentationPageValidator = v.object({
  presentation: v.nullable(resourceAccessPresentationValidator),
  cursor: v.nullable(v.string()),
})

export const canonicalTargetValidator = v.union(
  v.object({ kind: v.literal('resource'), resourceId: resourceIdValidator }),
  v.object({
    kind: v.literal('noteBlock'),
    resourceId: resourceIdValidator,
    blockId: v.string(),
    presentation: literals('block', 'heading'),
  }),
  v.object({
    kind: v.literal('mapPin'),
    resourceId: resourceIdValidator,
    pinId: mapPinIdValidator,
  }),
  v.object({
    kind: v.literal('canvasNode'),
    resourceId: resourceIdValidator,
    nodeId: v.string(),
  }),
)

export const authoredDestinationValidator = v.union(
  v.object({ kind: v.literal('internal'), target: canonicalTargetValidator }),
  v.object({ kind: v.literal('externalUrl'), url: v.string() }),
  v.object({ kind: v.literal('unresolved'), rawTarget: v.string() }),
)

export const referenceGraphEdgeValidator = v.object({
  sourceResourceId: resourceIdValidator,
  sourceVersion: versionStampValidator,
  target: canonicalTargetValidator,
})

const referenceSourceOccurrenceValidator = v.union(
  v.object({ kind: v.literal('resource') }),
  v.object({ kind: v.literal('noteBlock'), blockId: noteBlockIdValidator }),
)

const resourceReferenceDirectionValidator = v.union(
  v.object({
    status: v.literal('ready'),
    edges: v.array(referenceGraphEdgeValidator),
  }),
  v.object({ status: v.literal('capacity_exceeded') }),
)

export const fileClassificationValidator = literals(...Object.values(FILE_CLASSIFICATION))
export const fileViewerUnavailableReasonValidator = literals(
  ...Object.values(FILE_VIEWER_UNAVAILABLE_REASON),
)

export const fileOwnedMetadataValidators = {
  classification: fileClassificationValidator,
  byteSize: v.number(),
  detectedFormat: v.nullable(v.string()),
  extension: v.nullable(v.string()),
  mediaType: v.string(),
  viewerUnavailableReason: v.nullable(fileViewerUnavailableReasonValidator),
}

const fileResourceContentValidator = v.object({
  attachment: literals('attached', 'unattached'),
  ...fileOwnedMetadataValidators,
})

const mapImageContentValidator = v.union(
  v.object({ status: v.literal('unattached') }),
  v.object({
    status: v.literal('attached'),
    byteSize: v.number(),
    digest: v.string(),
    mediaType: v.string(),
  }),
)

const storedMapImageValidator = v.object({
  assetUuid: assetIdValidator,
  byteSize: v.number(),
  digest: v.string(),
  mediaType: v.string(),
})

const yjsHistoryCheckpointValidator = v.object({
  kind: literals(RESOURCE_KIND.note, RESOURCE_KIND.canvas),
  snapshotId: snapshotIdValidator,
  version: versionStampValidator,
})

const mapHistoryCheckpointValidator = v.object({
  kind: v.literal(RESOURCE_KIND.map),
  snapshotId: snapshotIdValidator,
  version: versionStampValidator,
})

const itemHistoryCheckpointValidator = v.union(
  yjsHistoryCheckpointValidator,
  mapHistoryCheckpointValidator,
)

const itemHistoryEntryFields = {
  historyEntryUuid: historyEntryIdValidator,
  campaignUuid: campaignIdValidator,
  resourceUuid: resourceIdValidator,
  actorMemberUuid: campaignMemberIdValidator,
  createdAt: v.number(),
}

function nullTimelineHistoryEntry<TAction extends string>(action: TAction) {
  return v.object({
    ...itemHistoryEntryFields,
    action: v.literal(action),
    metadata: v.null(),
  })
}

function objectTimelineHistoryEntry<TAction extends string, TMetadata extends PropertyValidators>(
  action: TAction,
  metadata: TMetadata,
) {
  return v.object({
    ...itemHistoryEntryFields,
    action: v.literal(action),
    metadata: v.object(metadata),
  })
}

const accessChangedHistoryMetadata = {
  subject: v.union(v.literal('all_players'), campaignMemberIdValidator),
  from: v.union(resourcePermissionValidator, v.literal('default')),
  to: v.union(resourcePermissionValidator, v.literal('default')),
}

const blockVisibilityChangedHistoryMetadata = {
  blockCount: v.number(),
  subject: v.union(v.literal('all_players'), campaignMemberIdValidator),
  visible: v.boolean(),
}

const inheritanceChangedHistoryMetadata = {
  from: folderAccessInheritanceValidator,
  to: folderAccessInheritanceValidator,
}

const itemHistoryEntryValidator = v.union(
  nullTimelineHistoryEntry(ITEM_HISTORY_ACTION.created),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.copied, {
    sourceResourceId: resourceIdValidator,
    sourceTitle: v.string(),
  }),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.renamed, {
    from: v.string(),
    to: v.string(),
  }),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.moved, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.iconChanged, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.colorChanged, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  nullTimelineHistoryEntry(ITEM_HISTORY_ACTION.trashed),
  nullTimelineHistoryEntry(ITEM_HISTORY_ACTION.restored),
  nullTimelineHistoryEntry(ITEM_HISTORY_ACTION.fileReplaced),
  nullTimelineHistoryEntry(ITEM_HISTORY_ACTION.fileRemoved),
  objectTimelineHistoryEntry(ITEM_HISTORY_ACTION.accessChanged, accessChangedHistoryMetadata),
  objectTimelineHistoryEntry(
    ITEM_HISTORY_ACTION.blockVisibilityChanged,
    blockVisibilityChangedHistoryMetadata,
  ),
  objectTimelineHistoryEntry(
    ITEM_HISTORY_ACTION.inheritanceChanged,
    inheritanceChangedHistoryMetadata,
  ),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.contentEdited),
    metadata: v.null(),
    checkpoint: yjsHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.contentRestored),
    metadata: v.object({
      restoredFromEntryId: historyEntryIdValidator,
      preservedSnapshotId: snapshotIdValidator,
    }),
    checkpoint: itemHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapImageChanged),
    metadata: v.object({ layerId: v.nullable(v.string()) }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapImageRemoved),
    metadata: v.object({ layerId: v.nullable(v.string()) }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinAdded),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinMoved),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinRemoved),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryEntryFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinVisibilityChanged),
    metadata: v.object({ pinLabel: v.string(), visible: v.boolean() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
)

const itemHistoryCheckpointFields = {
  snapshotUuid: snapshotIdValidator,
  campaignUuid: campaignIdValidator,
  resourceUuid: resourceIdValidator,
  version: versionStampValidator,
}

const itemHistoryCheckpointRowValidator = v.union(
  v.object({
    ...itemHistoryCheckpointFields,
    kind: literals(RESOURCE_KIND.note, RESOURCE_KIND.canvas),
    update: v.bytes(),
  }),
  v.object({
    ...itemHistoryCheckpointFields,
    kind: v.literal(RESOURCE_KIND.map),
    image: v.nullable(storedMapImageValidator),
    layers: v.array(
      v.object({
        id: v.string(),
        image: v.nullable(storedMapImageValidator),
        name: v.string(),
      }),
    ),
    pins: v.array(
      v.object({
        mapPinUuid: mapPinIdValidator,
        destination: authoredDestinationValidator,
        layerId: v.nullable(v.string()),
        x: v.number(),
        y: v.number(),
        visible: v.boolean(),
      }),
    ),
  }),
)

const mapResourceContentValidator = v.object({
  image: mapImageContentValidator,
  layers: v.array(
    v.object({
      id: v.string(),
      image: mapImageContentValidator,
      name: v.string(),
    }),
  ),
  pins: v.array(
    v.object({
      id: mapPinIdValidator,
      destination: authoredDestinationValidator,
      layerId: v.nullable(v.string()),
      x: v.number(),
      y: v.number(),
      visible: v.boolean(),
    }),
  ),
})

const itemHistoryActorValidator = v.object({
  id: campaignMemberIdValidator,
  displayName: v.string(),
  imageUrl: v.nullable(v.string()),
})

const itemHistoryPresentationFields = {
  id: historyEntryIdValidator,
  resourceId: resourceIdValidator,
  actor: itemHistoryActorValidator,
  createdAt: v.number(),
}

function nullTimelineHistoryPresentation<TAction extends string>(action: TAction) {
  return v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(action),
    metadata: v.null(),
  })
}

function objectTimelineHistoryPresentation<
  TAction extends string,
  TMetadata extends PropertyValidators,
>(action: TAction, metadata: TMetadata) {
  return v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(action),
    metadata: v.object(metadata),
  })
}

export const itemHistoryEntryPresentationValidator = v.union(
  nullTimelineHistoryPresentation(ITEM_HISTORY_ACTION.created),
  objectTimelineHistoryPresentation(ITEM_HISTORY_ACTION.copied, {
    sourceResourceId: resourceIdValidator,
    sourceTitle: v.string(),
  }),
  objectTimelineHistoryPresentation(ITEM_HISTORY_ACTION.renamed, {
    from: v.string(),
    to: v.string(),
  }),
  objectTimelineHistoryPresentation(ITEM_HISTORY_ACTION.moved, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  objectTimelineHistoryPresentation(ITEM_HISTORY_ACTION.iconChanged, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  objectTimelineHistoryPresentation(ITEM_HISTORY_ACTION.colorChanged, {
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  }),
  nullTimelineHistoryPresentation(ITEM_HISTORY_ACTION.trashed),
  nullTimelineHistoryPresentation(ITEM_HISTORY_ACTION.restored),
  nullTimelineHistoryPresentation(ITEM_HISTORY_ACTION.fileReplaced),
  nullTimelineHistoryPresentation(ITEM_HISTORY_ACTION.fileRemoved),
  objectTimelineHistoryPresentation(
    ITEM_HISTORY_ACTION.accessChanged,
    accessChangedHistoryMetadata,
  ),
  objectTimelineHistoryPresentation(
    ITEM_HISTORY_ACTION.blockVisibilityChanged,
    blockVisibilityChangedHistoryMetadata,
  ),
  objectTimelineHistoryPresentation(
    ITEM_HISTORY_ACTION.inheritanceChanged,
    inheritanceChangedHistoryMetadata,
  ),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.contentEdited),
    metadata: v.null(),
    checkpoint: yjsHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.contentRestored),
    metadata: v.object({
      restoredFromEntryId: historyEntryIdValidator,
      preservedSnapshotId: snapshotIdValidator,
    }),
    checkpoint: itemHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapImageChanged),
    metadata: v.object({ layerId: v.nullable(v.string()) }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapImageRemoved),
    metadata: v.object({ layerId: v.nullable(v.string()) }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinAdded),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinMoved),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinRemoved),
    metadata: v.object({ pinLabel: v.string() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
  v.object({
    ...itemHistoryPresentationFields,
    action: v.literal(ITEM_HISTORY_ACTION.mapPinVisibilityChanged),
    metadata: v.object({ pinLabel: v.string(), visible: v.boolean() }),
    checkpoint: mapHistoryCheckpointValidator,
  }),
)

export const itemHistoryPageValidator = v.union(
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: v.literal('ready'),
    entries: v.array(itemHistoryEntryPresentationValidator),
    nextCursor: v.nullable(v.string()),
  }),
)

export const itemHistoryPreviewResultValidator = v.union(
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: v.literal('ready'),
    preview: v.union(
      v.object({
        kind: literals(RESOURCE_KIND.note, RESOURCE_KIND.canvas),
        snapshotId: snapshotIdValidator,
        version: versionStampValidator,
        update: v.bytes(),
      }),
      v.object({
        kind: v.literal(RESOURCE_KIND.map),
        snapshotId: snapshotIdValidator,
        version: versionStampValidator,
        content: mapResourceContentValidator,
        images: v.array(
          v.object({
            layerId: v.nullable(v.string()),
            url: v.string(),
          }),
        ),
      }),
    ),
  }),
)

export const itemHistoryRestoredReceiptValidator = v.object({
  status: v.literal('restored'),
  operationId: operationIdValidator,
  historyEntryId: historyEntryIdValidator,
  preservedSnapshotId: snapshotIdValidator,
  restoredFromEntryId: historyEntryIdValidator,
})

const itemHistoryRestoreRejectionValidator = v.object({
  status: v.literal('rejected'),
  operationId: operationIdValidator,
  reason: literals(
    'content_changed',
    'history_entry_unavailable',
    'operation_id_reused',
    'resource_unavailable',
    'snapshot_incompatible',
    'snapshot_unavailable',
    'unauthorized',
  ),
})

export const itemHistoryRestoreResultValidator = v.union(
  itemHistoryRestoredReceiptValidator,
  itemHistoryRestoreRejectionValidator,
  v.object({ status: literals('unavailable', 'failed') }),
)

const contentInitializingMutationResultValidator = v.object({
  status: v.literal('retryable'),
  reason: v.literal('content_initializing'),
})

export const mapContentMutationResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    content: mapResourceContentValidator,
    version: versionStampValidator,
  }),
  contentInitializingMutationResultValidator,
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'content_corrupt',
      'content_missing',
      'invalid_command',
      'layer_missing',
      'operation_id_reused',
      'pin_missing',
      'resource_missing',
      'target_missing',
      'unauthorized',
      'version_conflict',
      'version_exhausted',
    ),
  }),
)

export const mapContentCommandValidator = v.union(
  v.object({
    type: v.literal('createPins'),
    pins: v.array(
      v.object({
        id: mapPinIdValidator,
        destination: authoredDestinationValidator,
        layerId: v.nullable(v.string()),
        x: v.number(),
        y: v.number(),
      }),
    ),
  }),
  v.object({
    type: v.literal('movePin'),
    pinId: mapPinIdValidator,
    x: v.number(),
    y: v.number(),
  }),
  v.object({
    type: v.literal('setPinVisibility'),
    pinId: mapPinIdValidator,
    visible: v.boolean(),
  }),
  v.object({ type: v.literal('removePin'), pinId: mapPinIdValidator }),
)

export const fileContentReplaceResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    content: fileResourceContentValidator,
    version: versionStampValidator,
  }),
  contentInitializingMutationResultValidator,
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'content_corrupt',
      'content_missing',
      'invalid_file',
      'resource_missing',
      'unauthorized',
      'version_conflict',
      'version_exhausted',
    ),
  }),
)

export const fileAssetCreationResultValidator = v.union(
  v.object({ status: v.literal('completed'), resourceId: resourceIdValidator }),
  v.object({ status: v.literal('rejected'), reason: v.string() }),
)

export const resourceProjectionScopeValidator = v.object({
  campaignId: campaignIdValidator,
  actorId: campaignMemberIdValidator,
  projection: literals('dm', 'player', 'view_as_player'),
  schema: v.literal(RESOURCE_INDEX_SCHEMA),
})

export const resourceCollectionQueryValidator = v.object({
  parentId: v.nullable(resourceIdValidator),
  lifecycle: literals('active', 'trashed'),
  kinds: v.optional(v.array(resourceKindValidator)),
})

export const authorizedResourceSummaryValidator = v.object({
  id: resourceIdValidator,
  campaignId: campaignIdValidator,
  displayParentId: v.nullable(resourceIdValidator),
  kind: resourceKindValidator,
  title: v.string(),
  icon: v.nullable(v.string()),
  color: v.nullable(v.string()),
  lifecycle: literals('active', 'trashed'),
  permission: grantedResourcePermissionValidator,
  metadataVersion: versionStampValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const workspaceSearchResultValidator = v.object({
  resourceId: resourceIdValidator,
  match: v.union(
    v.object({ type: v.literal('title') }),
    v.object({ type: v.literal('body'), text: v.string() }),
  ),
})

export const resourceBookmarkMutationResultValidator = v.union(
  v.object({ status: v.literal('completed') }),
  v.object({
    status: v.literal('rejected'),
    reason: literals('invalid_request', 'selection_too_large', 'resource_missing'),
  }),
)

export const authorizedResourceSnapshotValidator = v.object({
  scope: resourceProjectionScopeValidator,
  revision: v.string(),
  resources: v.array(authorizedResourceSummaryValidator),
  missingResourceIds: v.array(resourceIdValidator),
  collections: v.array(
    v.object({
      query: resourceCollectionQueryValidator,
      resourceIds: v.array(resourceIdValidator),
      complete: v.boolean(),
    }),
  ),
})

export const resourceReferenceSnapshotValidator = v.union(
  v.object({
    status: v.literal('ready'),
    outgoing: resourceReferenceDirectionValidator,
    backlinks: resourceReferenceDirectionValidator,
    snapshot: authorizedResourceSnapshotValidator,
  }),
  v.object({ status: v.literal('unavailable') }),
  v.object({ status: v.literal('integrity_error') }),
)

const resourceAuditFields = {
  createdAt: v.number(),
  createdByMemberUuid: campaignMemberIdValidator,
  updatedAt: v.number(),
  updatedByMemberUuid: campaignMemberIdValidator,
}

const resourceCommonFields = {
  resourceUuid: resourceIdValidator,
  campaignUuid: campaignIdValidator,
  parentResourceUuid: v.nullable(resourceIdValidator),
  kind: resourceKindValidator,
  title: v.string(),
  icon: v.nullable(v.string()),
  color: v.nullable(v.string()),
  metadataVersion: versionStampValidator,
  ...resourceAuditFields,
}

const resourceTableValidator = v.union(
  v.object({
    ...resourceCommonFields,
    lifecycle: v.literal('active'),
    trashedAt: v.null(),
    trashedByMemberUuid: v.null(),
  }),
  v.object({
    ...resourceCommonFields,
    lifecycle: v.literal('trashed'),
    trashedAt: v.number(),
    trashedByMemberUuid: campaignMemberIdValidator,
  }),
)

export const resourcePostconditionValidator = v.union(
  v.object({
    state: v.literal('present'),
    resourceId: resourceIdValidator,
    metadataVersion: versionStampValidator,
  }),
  v.object({ state: v.literal('missing'), resourceId: resourceIdValidator }),
)

const resourceStructureResultValidator = v.union(
  v.object({ type: v.literal('created'), resourceId: resourceIdValidator }),
  v.object({ type: v.literal('metadataUpdated'), resourceId: resourceIdValidator }),
  v.object({ type: v.literal('moved'), resourceIds: v.array(resourceIdValidator) }),
  v.object({ type: v.literal('trashed'), resourceIds: v.array(resourceIdValidator) }),
  v.object({ type: v.literal('restored'), resourceIds: v.array(resourceIdValidator) }),
  v.object({ type: v.literal('permanentlyDeleted'), resourceIds: v.array(resourceIdValidator) }),
  v.object({
    type: v.literal('deepCopied'),
    roots: v.array(
      v.object({
        sourceRootId: resourceIdValidator,
        destinationRootId: resourceIdValidator,
      }),
    ),
  }),
)

const resourceMetadataChangesValidator = v.object({
  title: v.optional(v.string()),
  icon: v.optional(v.nullable(v.string())),
  color: v.optional(v.nullable(v.string())),
})

export const resourceStructureCommandValidator = v.union(
  v.object({
    type: v.literal('create'),
    resourceId: resourceIdValidator,
    kind: resourceKindValidator,
    parentId: v.nullable(resourceIdValidator),
    title: v.string(),
    icon: v.nullable(v.string()),
    color: v.nullable(v.string()),
  }),
  v.object({
    type: v.literal('updateMetadata'),
    resourceId: resourceIdValidator,
    changes: resourceMetadataChangesValidator,
  }),
  v.object({
    type: v.literal('move'),
    resourceIds: v.array(resourceIdValidator),
    destinationParentId: v.nullable(resourceIdValidator),
  }),
  v.object({ type: v.literal('trash'), resourceIds: v.array(resourceIdValidator) }),
  v.object({
    type: v.literal('restore'),
    resourceIds: v.array(resourceIdValidator),
    destination: v.union(v.literal('previousParent'), v.null(), resourceIdValidator),
  }),
  v.object({ type: v.literal('permanentlyDelete'), resourceIds: v.array(resourceIdValidator) }),
  v.object({
    type: v.literal('deepCopy'),
    sourceRootIds: v.array(resourceIdValidator),
    destinationParentId: v.nullable(resourceIdValidator),
  }),
)

export const resourceCompensationPlanValidator = v.union(
  v.object({
    type: v.literal('updateMetadata'),
    resourceId: resourceIdValidator,
    changes: resourceMetadataChangesValidator,
    requiredPostconditions: v.array(resourcePostconditionValidator),
  }),
  v.object({
    type: v.literal('move'),
    placements: v.array(
      v.object({
        resourceId: resourceIdValidator,
        destinationParentId: v.nullable(resourceIdValidator),
      }),
    ),
    requiredPostconditions: v.array(resourcePostconditionValidator),
  }),
  v.object({
    type: literals('trash', 'restore'),
    resourceIds: v.array(resourceIdValidator),
    expectedClosureResourceIds: v.array(resourceIdValidator),
    requiredPostconditions: v.array(resourcePostconditionValidator),
  }),
)

export const resourceCommandReceiptValidator = v.object({
  campaignId: campaignIdValidator,
  operationId: operationIdValidator,
  result: resourceStructureResultValidator,
  postconditions: v.array(resourcePostconditionValidator),
})

export const resourceStructureCommandResultValidator = v.union(
  v.object({ status: v.literal('completed'), receipt: resourceCommandReceiptValidator }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_command',
      'invalid_uuid',
      'invalid_title',
      'ownership_mismatch',
      'unauthorized',
      'resource_missing',
      'invalid_parent',
      'invalid_parent_kind',
      'hierarchy_cycle',
      'invalid_lifecycle',
      'invalid_root_selection',
      'protected_resource',
      'closure_too_large',
      'content_unavailable',
      'content_integrity_failure',
      'version_exhausted',
      'operation_id_reused',
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: literals('capability_not_supported', 'dependency_unavailable', 'scope_unavailable'),
  }),
)

export const resourceCompensationResultValidator = v.union(
  v.object({ status: v.literal('completed'), receipt: resourceCommandReceiptValidator }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_uuid',
      'ownership_mismatch',
      'unauthorized',
      'history_missing',
      'history_conflict',
      'history_irreversible',
      'operation_id_reused',
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: literals('capability_not_supported', 'dependency_unavailable', 'scope_unavailable'),
  }),
)

export const contentProviderSaveResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    generation: v.number(),
    resourceId: resourceIdValidator,
    update: v.bytes(),
    version: versionStampValidator,
  }),
  v.object({
    status: v.literal('retryable'),
    reason: v.literal('dependency_pending'),
    stateVector: v.bytes(),
  }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'unauthorized',
      'content_missing',
      'content_corrupt',
      'content_generation_conflict',
      'content_limit_exceeded',
      'version_exhausted',
    ),
  }),
)

export const contentRecoveryActionResultValidator = v.union(
  v.object({ status: v.literal('completed') }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'content_changed',
      'operation_id_reused',
      'resource_unavailable',
      'snapshot_incompatible',
      'scope_unavailable',
      'unauthorized',
    ),
  }),
)

const contentUnavailableSnapshotValidator = v.object({
  status: v.literal('unavailable'),
  reason: literals('capability_not_supported', 'unauthorized'),
})

const contentIntegritySnapshotValidator = v.object({
  status: v.literal('integrity_error'),
  issue: literals(
    'content_missing',
    'content_corrupt',
    'content_limit_exceeded',
    'version_mismatch',
  ),
})

export const mapImageDownloadSnapshotValidator = v.union(
  v.object({ status: v.literal('loading') }),
  v.object({
    status: v.literal('ready'),
    image: mapImageContentValidator,
    url: v.string(),
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const noteContentSnapshotValidator = v.union(
  v.object({ status: v.literal('initializing'), operationId: operationIdValidator }),
  v.object({ status: v.literal('empty'), reason: v.literal('no_visible_blocks') }),
  v.object({
    status: v.literal('ready'),
    generation: v.number(),
    update: v.bytes(),
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const resourcePresenceSnapshotValidator = v.union(
  v.object({
    status: v.literal('ready'),
    entries: v.array(
      v.object({
        clientId: v.number(),
        memberId: campaignMemberIdValidator,
        state: v.bytes(),
        user: v.object({ name: v.string(), color: v.string() }),
      }),
    ),
  }),
  contentUnavailableSnapshotValidator,
  v.object({ status: v.literal('unavailable'), reason: v.literal('capacity_exceeded') }),
)

export const resourcePresenceHeartbeatResultValidator = v.union(
  v.object({
    status: v.literal('active'),
    roomToken: v.string(),
    sessionToken: v.string(),
  }),
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: v.literal('rejected'),
    reason: v.literal('invalid_client'),
  }),
)

export const resourcePresenceUpdateResultValidator = v.union(
  v.object({ status: v.literal('active') }),
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: v.literal('rejected'),
    reason: literals('invalid_update', 'payload_too_large'),
  }),
)

export const resourcePresenceReleaseResultValidator = v.union(
  v.object({ status: v.literal('released') }),
  v.object({ status: v.literal('unavailable') }),
)

export const fileDownloadSnapshotValidator = v.union(
  v.object({ status: v.literal('loading') }),
  v.object({
    status: v.literal('ready'),
    url: v.nullable(v.string()),
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const fileContentSnapshotValidator = v.union(
  v.object({ status: v.literal('initializing'), operationId: operationIdValidator }),
  v.object({
    status: v.literal('ready'),
    content: fileResourceContentValidator,
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const mapContentSnapshotValidator = v.union(
  v.object({ status: v.literal('initializing'), operationId: operationIdValidator }),
  v.object({
    status: v.literal('ready'),
    content: mapResourceContentValidator,
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const canvasContentSnapshotValidator = v.union(
  v.object({
    status: v.literal('ready'),
    generation: v.number(),
    update: v.bytes(),
    version: versionStampValidator,
  }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

const externalEffectAttemptFields = {
  attempts: v.number(),
  lastAttemptAt: v.nullable(v.number()),
  lastError: v.nullable(v.string()),
  createdAt: v.number(),
}

export const resourceTables = {
  resources: defineTable(resourceTableValidator)
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid'])
    .index('by_campaign_and_parent', ['campaignUuid', 'parentResourceUuid'])
    .index('by_campaign_and_lifecycle', ['campaignUuid', 'lifecycle'])
    .index('by_campaign_and_lifecycle_and_resource', ['campaignUuid', 'lifecycle', 'resourceUuid'])
    .index('by_campaign_and_parent_and_lifecycle_and_resource', [
      'campaignUuid',
      'parentResourceUuid',
      'lifecycle',
      'resourceUuid',
    ]),

  resourceTombstones: defineTable({
    resourceUuid: resourceIdValidator,
    campaignUuid: campaignIdValidator,
    deletionVersion: versionStampValidator,
    deletedAt: v.number(),
  })
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid']),

  resourceSourcePathAliases: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    importJobUuid: importJobIdValidator,
    sourceRootId: v.string(),
    rawPath: v.string(),
    normalizedPath: v.string(),
  })
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid'])
    .index('by_import_entry', [
      'campaignUuid',
      'resourceUuid',
      'importJobUuid',
      'sourceRootId',
      'normalizedPath',
    ]),

  resourceTransferJobs: defineTable({
    campaignUuid: campaignIdValidator,
    importJobUuid: importJobIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    manifestVersion: v.literal('plain-transfer-manifest-v1'),
    fingerprint: v.string(),
    destinationParentUuid: v.nullable(resourceIdValidator),
    textFileHandling: literals('files', 'notes'),
    sources: v.array(
      v.object({
        id: v.string(),
        kind: literals('directory', 'file', 'zip'),
        name: v.string(),
      }),
    ),
    status: literals('reserved', 'running', 'settled'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_campaign_and_importJobUuid', ['campaignUuid', 'importJobUuid']),

  resourceTransferEntries: defineTable({
    campaignUuid: campaignIdValidator,
    importJobUuid: importJobIdValidator,
    sourceRootId: v.string(),
    sourceEntryPath: v.string(),
    rawPath: v.string(),
    normalizedPath: v.string(),
    plannedResourceUuid: resourceIdValidator,
    plannedOperationUuid: operationIdValidator,
    parentResourceUuid: v.nullable(resourceIdValidator),
    title: v.string(),
    entryType: literals('directory', 'file'),
    isExplicit: v.boolean(),
    declaredByteSize: v.number(),
    uploadSessionUuid: v.nullable(v.id('fileStorage')),
    resourceKind: v.nullable(
      literals(RESOURCE_KIND.folder, RESOURCE_KIND.note, RESOURCE_KIND.file),
    ),
    resourceUuid: v.nullable(resourceIdValidator),
    status: literals('pending', 'completed', 'cancelled', 'rejected'),
    rejectionReason: v.nullable(v.string()),
  })
    .index('by_campaign_and_job', ['campaignUuid', 'importJobUuid'])
    .index('by_campaign_and_job_and_source_and_path', [
      'campaignUuid',
      'importJobUuid',
      'sourceRootId',
      'normalizedPath',
    ]),

  resourceOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: resourceCommandReceiptValidator,
    compensation: v.nullable(resourceCompensationPlanValidator),
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  itemHistoryEntries: defineTable(itemHistoryEntryValidator)
    .index('by_historyEntryUuid', ['historyEntryUuid'])
    .index('by_resource_history', ['campaignUuid', 'resourceUuid', 'createdAt', 'historyEntryUuid'])
    .index('by_resource_action_history', [
      'campaignUuid',
      'resourceUuid',
      'action',
      'createdAt',
      'historyEntryUuid',
    ]),

  itemHistoryCheckpoints: defineTable(itemHistoryCheckpointRowValidator)
    .index('by_snapshotUuid', ['snapshotUuid'])
    .index('by_resource_snapshot', ['campaignUuid', 'resourceUuid', 'snapshotUuid']),

  itemHistoryCheckpointAssets: defineTable({
    snapshotUuid: snapshotIdValidator,
    assetUuid: assetIdValidator,
  })
    .index('by_snapshot', ['snapshotUuid', 'assetUuid'])
    .index('by_assetUuid', ['assetUuid']),

  itemHistoryCaptureIntents: defineTable({
    resourceUuid: resourceIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    version: versionStampValidator,
  }).index('by_resourceUuid', ['resourceUuid']),

  itemHistoryRestoreOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    resourceUuid: resourceIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(ITEM_HISTORY_RESTORE_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: itemHistoryRestoredReceiptValidator,
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid'])
    .index('by_resource', ['campaignUuid', 'resourceUuid']),

  yjsRecoveryReapplyOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    resourceUuid: resourceIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION),
    fingerprint: v.string(),
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  resourceBookmarks: defineTable({
    campaignUuid: campaignIdValidator,
    memberUuid: campaignMemberIdValidator,
    resourceUuid: resourceIdValidator,
    bookmarkedAt: v.number(),
  })
    .index('by_member', ['campaignUuid', 'memberUuid'])
    .index('by_member_and_resource', ['campaignUuid', 'memberUuid', 'resourceUuid'])
    .index('by_resource', ['campaignUuid', 'resourceUuid']),

  resourceAccessPolicies: defineTable(
    v.union(
      v.object({
        campaignUuid: campaignIdValidator,
        resourceUuid: resourceIdValidator,
        audienceAccess: resourceAudienceAccessValidator,
        subject: v.literal('folder'),
        inheritance: folderAccessInheritanceValidator,
      }),
      v.object({
        campaignUuid: campaignIdValidator,
        resourceUuid: resourceIdValidator,
        audienceAccess: resourceAudienceAccessValidator,
        subject: v.literal('resource'),
      }),
    ),
  )
    .index('by_campaign', ['campaignUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid']),

  resourceMemberAccess: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    memberUuid: campaignMemberIdValidator,
    permission: resourcePermissionValidator,
  })
    .index('by_campaign', ['campaignUuid'])
    .index('by_resource', ['campaignUuid', 'resourceUuid'])
    .index('by_resource_and_member', ['campaignUuid', 'resourceUuid', 'memberUuid'])
    .index('by_member', ['campaignUuid', 'memberUuid']),

  resourceAccessOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: resourceAccessReceiptValidator,
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  noteBlockAudienceAccess: defineTable({
    campaignUuid: campaignIdValidator,
    noteUuid: resourceIdValidator,
    blockUuid: noteBlockIdValidator,
  })
    .index('by_campaign', ['campaignUuid'])
    .index('by_note', ['campaignUuid', 'noteUuid'])
    .index('by_note_and_block', ['campaignUuid', 'noteUuid', 'blockUuid']),

  noteBlockMemberAccess: defineTable({
    campaignUuid: campaignIdValidator,
    noteUuid: resourceIdValidator,
    blockUuid: noteBlockIdValidator,
    memberUuid: campaignMemberIdValidator,
    visibility: noteBlockVisibilityValidator,
  })
    .index('by_campaign', ['campaignUuid'])
    .index('by_note', ['campaignUuid', 'noteUuid'])
    .index('by_note_and_block', ['campaignUuid', 'noteUuid', 'blockUuid'])
    .index('by_block_and_member', ['campaignUuid', 'noteUuid', 'blockUuid', 'memberUuid'])
    .index('by_note_and_member', ['campaignUuid', 'noteUuid', 'memberUuid'])
    .index('by_member', ['campaignUuid', 'memberUuid']),

  noteBlockAccessCleanupIntents: defineTable({
    campaignUuid: campaignIdValidator,
    noteUuid: resourceIdValidator,
    contentVersion: versionStampValidator,
    stage: v.union(v.literal('audience'), v.literal('member')),
    cursor: v.nullable(v.string()),
  })
    .index('by_campaign', ['campaignUuid'])
    .index('by_note', ['campaignUuid', 'noteUuid']),

  noteBlockAccessOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: noteBlockAccessReceiptValidator,
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  resourceSearchDocuments: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    title: v.string(),
    normalizedTitle: v.string(),
    body: v.string(),
    preview: resourcePreviewValidator,
  })
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid'])
    .index('by_campaign_and_normalized_title', ['campaignUuid', 'normalizedTitle', 'resourceUuid'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['campaignUuid'],
    })
    .searchIndex('search_body', {
      searchField: 'body',
      filterFields: ['campaignUuid'],
    }),

  resourceReferenceEdges: defineTable({
    campaignUuid: campaignIdValidator,
    sourceResourceUuid: resourceIdValidator,
    sourceVersion: versionStampValidator,
    source: referenceSourceOccurrenceValidator,
    targetResourceUuid: resourceIdValidator,
    target: canonicalTargetValidator,
  })
    .index('by_campaign_and_source', ['campaignUuid', 'sourceResourceUuid'])
    .index('by_campaign_and_target', ['campaignUuid', 'targetResourceUuid', 'sourceResourceUuid']),

  resourceNoteContents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    creationOperationUuid: operationIdValidator,
    generation: v.optional(v.number()),
    update: v.bytes(),
    version: versionStampValidator,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid']),

  resourceFileContents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    state: literals('initializing', 'ready', 'failed'),
    assetUuid: v.nullable(assetIdValidator),
    ...fileOwnedMetadataValidators,
    version: versionStampValidator,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid']),

  resourceMapContents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    state: literals('initializing', 'ready', 'failed'),
    image: v.nullable(storedMapImageValidator),
    layers: v.array(
      v.object({
        id: v.string(),
        image: v.nullable(storedMapImageValidator),
        name: v.string(),
      }),
    ),
    recentOperations: v.array(
      v.object({
        operationUuid: operationIdValidator,
        actorUuid: campaignMemberIdValidator,
        fingerprint: v.string(),
      }),
    ),
    version: versionStampValidator,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid']),

  resourceMapPins: defineTable({
    campaignUuid: campaignIdValidator,
    mapResourceUuid: resourceIdValidator,
    mapPinUuid: mapPinIdValidator,
    destination: authoredDestinationValidator,
    layerId: v.nullable(v.string()),
    x: v.number(),
    y: v.number(),
    visible: v.boolean(),
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_mapResourceUuid', ['mapResourceUuid'])
    .index('by_mapPinUuid', ['mapPinUuid']),

  resourceCanvasContents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    generation: v.optional(v.number()),
    update: v.bytes(),
    version: versionStampValidator,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid']),

  resourceAssetCopyIntents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    operationUuid: operationIdValidator,
    sourceAssetUuid: assetIdValidator,
    destinationAssetUuid: assetIdValidator,
    status: literals('pending', 'processing', 'failed'),
    ...externalEffectAttemptFields,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_sourceAssetUuid', ['sourceAssetUuid'])
    .index('by_destinationAssetUuid', ['destinationAssetUuid'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

  resourceAssetRetirementCandidates: defineTable({
    assetUuid: assetIdValidator,
    status: literals('pending', 'processing', 'failed'),
    ...externalEffectAttemptFields,
  })
    .index('by_assetUuid', ['assetUuid'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

  resourceAssetOwners: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    assetUuid: assetIdValidator,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_assetUuid', ['assetUuid']),
}
