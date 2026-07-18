import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { RESOURCE_KIND } from '@wizard-archive/editor/resources/resource-record'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { campaignIdValidator, campaignMemberIdValidator } from '../campaigns/schema'
import {
  assetIdValidator,
  importJobIdValidator,
  mapPinIdValidator,
  operationIdValidator,
  resourceIdValidator,
} from './validators'
import {
  FILE_CLASSIFICATION,
  FILE_VIEWER_UNAVAILABLE_REASON,
} from '@wizard-archive/editor/resources/file-content-contract'
import {
  FOLDER_ACCESS_INHERITANCE,
  RESOURCE_PERMISSION,
} from '@wizard-archive/editor/resources/access-policy'

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

export const resourceKindValidator = literals(...Object.values(RESOURCE_KIND))
export const resourcePermissionValidator = literals(...Object.values(RESOURCE_PERMISSION))
const grantedResourcePermissionValidator = literals(
  RESOURCE_PERMISSION.view,
  RESOURCE_PERMISSION.edit,
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
const canonicalTargetValidator = v.union(
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

export const resourceProjectionScopeValidator = v.object({
  campaignId: campaignIdValidator,
  actorId: campaignMemberIdValidator,
  projection: literals('dm', 'player'),
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

export const resourceBookmarkCommandValidator = v.object({
  type: v.literal('setBookmarkState'),
  resourceIds: v.array(resourceIdValidator),
  bookmarked: v.boolean(),
})

const resourceBookmarkReceiptValidator = v.object({
  campaignId: campaignIdValidator,
  operationId: operationIdValidator,
  resourceIds: v.array(resourceIdValidator),
  bookmarked: v.boolean(),
})

export const resourceBookmarkCommandResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    receipt: resourceBookmarkReceiptValidator,
  }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_command',
      'selection_too_large',
      'ownership_mismatch',
      'unauthorized',
      'resource_missing',
      'operation_id_reused',
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: literals('capability_not_supported', 'dependency_unavailable', 'scope_unavailable'),
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
  v.object({ type: v.literal('restore'), resourceIds: v.array(resourceIdValidator) }),
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
      'content_limit_exceeded',
      'version_exhausted',
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
  v.object({ status: v.literal('ready'), update: v.bytes(), version: versionStampValidator }),
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

  resourceAssetsFolders: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
  })
    .index('by_campaign', ['campaignUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid']),

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
        audiencePermission: resourcePermissionValidator,
        subject: v.literal('folder'),
        inheritance: folderAccessInheritanceValidator,
      }),
      v.object({
        campaignUuid: campaignIdValidator,
        resourceUuid: resourceIdValidator,
        audiencePermission: resourcePermissionValidator,
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

  resourceBookmarkOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    operationUuid: operationIdValidator,
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: resourceBookmarkReceiptValidator,
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  resourceSearchDocuments: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    title: v.string(),
    normalizedTitle: v.string(),
    body: v.string(),
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

  resourceNoteContents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    creationOperationUuid: operationIdValidator,
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
