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

export const versionStampValidator = v.object({
  scheme: v.literal(VERSION_SCHEME),
  revision: v.number(),
  digest: v.string(),
})

export const resourceKindValidator = literals(...Object.values(RESOURCE_KIND))
export const fileClassificationValidator = literals(...Object.values(FILE_CLASSIFICATION))
export const fileViewerUnavailableReasonValidator = literals(
  ...Object.values(FILE_VIEWER_UNAVAILABLE_REASON),
)

const fileOwnedMetadataValidators = {
  classification: fileClassificationValidator,
  byteSize: v.number(),
  detectedFormat: v.nullable(v.string()),
  extension: v.nullable(v.string()),
  mediaType: v.string(),
  viewerUnavailableReason: v.nullable(fileViewerUnavailableReasonValidator),
}

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

export const resourceBookmarkCommandResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    receipt: v.object({
      campaignId: campaignIdValidator,
      operationId: operationIdValidator,
      resourceIds: v.array(resourceIdValidator),
      bookmarked: v.boolean(),
    }),
  }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_command',
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

const resourcePostconditionValidator = v.union(
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
    changes: v.object({
      title: v.optional(v.string()),
      icon: v.optional(v.nullable(v.string())),
      color: v.optional(v.nullable(v.string())),
    }),
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

export const bindNoteContentResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    resourceId: resourceIdValidator,
    version: versionStampValidator,
  }),
  v.object({
    status: v.literal('rejected'),
    reason: literals(
      'invalid_uuid',
      'resource_missing',
      'ownership_mismatch',
      'wrong_kind',
      'operation_mismatch',
      'content_missing',
      'content_corrupt',
      'already_initialized',
    ),
  }),
)

const contentUnavailableSnapshotValidator = v.object({
  status: v.literal('unavailable'),
  reason: literals('capability_not_supported', 'unauthorized'),
})

const contentIntegritySnapshotValidator = v.object({
  status: v.literal('integrity_error'),
  issue: literals('content_missing', 'content_corrupt', 'version_mismatch'),
})

export const noteContentSnapshotValidator = v.union(
  v.object({ status: v.literal('initializing'), operationId: operationIdValidator }),
  v.object({ status: v.literal('ready'), update: v.bytes(), version: versionStampValidator }),
  contentUnavailableSnapshotValidator,
  contentIntegritySnapshotValidator,
)

export const resourceContentSnapshotValidator = v.union(
  v.object({ status: v.literal('initializing'), operationId: operationIdValidator }),
  v.object({
    status: v.literal('ready'),
    kind: v.literal('file'),
    content: v.object({
      assetId: v.nullable(assetIdValidator),
      ...fileOwnedMetadataValidators,
    }),
    version: versionStampValidator,
  }),
  v.object({
    status: v.literal('ready'),
    kind: v.literal('map'),
    content: v.object({
      imageAssetId: v.nullable(assetIdValidator),
      layers: v.array(
        v.object({
          id: v.string(),
          imageAssetId: v.nullable(assetIdValidator),
          name: v.string(),
        }),
      ),
      pins: v.array(
        v.object({
          id: mapPinIdValidator,
          targetResourceId: resourceIdValidator,
          layerId: v.nullable(v.string()),
          x: v.number(),
          y: v.number(),
          visible: v.boolean(),
        }),
      ),
    }),
    version: versionStampValidator,
  }),
  v.object({
    status: v.literal('ready'),
    kind: v.literal('canvas'),
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

  resourceBookmarkOperations: defineTable({
    campaignUuid: campaignIdValidator,
    actorMemberUuid: campaignMemberIdValidator,
    operationUuid: operationIdValidator,
    resourceUuids: v.array(resourceIdValidator),
    bookmarked: v.boolean(),
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  resourceNoteContents: defineTable(
    v.union(
      v.object({
        campaignUuid: campaignIdValidator,
        resourceUuid: resourceIdValidator,
        state: v.literal('initializing'),
        initializationOperationUuid: operationIdValidator,
      }),
      v.object({
        campaignUuid: campaignIdValidator,
        resourceUuid: resourceIdValidator,
        state: v.literal('ready'),
        initializationOperationUuid: operationIdValidator,
        update: v.bytes(),
        version: versionStampValidator,
      }),
    ),
  )
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid']),

  resourceNoteInitializationIntents: defineTable({
    campaignUuid: campaignIdValidator,
    resourceUuid: resourceIdValidator,
    operationUuid: operationIdValidator,
    status: literals('pending', 'failed'),
    ...externalEffectAttemptFields,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

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
    imageAssetUuid: v.nullable(assetIdValidator),
    layers: v.array(
      v.object({
        id: v.string(),
        imageAssetUuid: v.nullable(assetIdValidator),
        name: v.string(),
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
    targetResourceUuid: resourceIdValidator,
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
