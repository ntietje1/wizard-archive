import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { RESOURCE_KIND } from '@wizard-archive/editor/resources/resource-record'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'

export const resourceUuidValidator = v.string()
export const campaignUuidValidator = v.string()
export const campaignMemberUuidValidator = v.string()

export const versionStampValidator = v.object({
  scheme: v.literal(VERSION_SCHEME),
  revision: v.number(),
  digest: v.string(),
})

export const resourceKindValidator = literals(...Object.values(RESOURCE_KIND))

export const resourceProjectionScopeValidator = v.object({
  campaignId: campaignUuidValidator,
  actorId: campaignMemberUuidValidator,
  projection: v.string(),
  schema: v.string(),
})

export const resourceCollectionQueryValidator = v.object({
  parentId: v.nullable(resourceUuidValidator),
  lifecycle: literals('active', 'trashed'),
  kinds: v.optional(v.array(resourceKindValidator)),
})

export const authorizedResourceSummaryValidator = v.object({
  id: resourceUuidValidator,
  campaignId: campaignUuidValidator,
  displayParentId: v.nullable(resourceUuidValidator),
  kind: resourceKindValidator,
  title: v.string(),
  icon: v.nullable(v.string()),
  color: v.nullable(v.string()),
  lifecycle: literals('active', 'trashed'),
  metadataVersion: versionStampValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const authorizedResourceSnapshotValidator = v.object({
  scope: resourceProjectionScopeValidator,
  revision: v.string(),
  resources: v.array(authorizedResourceSummaryValidator),
  missingResourceIds: v.array(resourceUuidValidator),
  collections: v.array(
    v.object({
      query: resourceCollectionQueryValidator,
      resourceIds: v.array(resourceUuidValidator),
      complete: v.boolean(),
    }),
  ),
})

const resourceAuditFields = {
  createdAt: v.number(),
  createdByMemberUuid: campaignMemberUuidValidator,
  updatedAt: v.number(),
  updatedByMemberUuid: campaignMemberUuidValidator,
}

const resourceCommonFields = {
  resourceUuid: resourceUuidValidator,
  campaignUuid: campaignUuidValidator,
  parentResourceUuid: v.nullable(resourceUuidValidator),
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
    trashedByMemberUuid: campaignMemberUuidValidator,
  }),
)

const resourcePostconditionValidator = v.union(
  v.object({
    state: v.literal('present'),
    resourceId: resourceUuidValidator,
    metadataVersion: versionStampValidator,
  }),
  v.object({ state: v.literal('missing'), resourceId: resourceUuidValidator }),
)

const resourceStructureResultValidator = v.union(
  v.object({ type: v.literal('created'), resourceId: resourceUuidValidator }),
  v.object({ type: v.literal('metadataUpdated'), resourceId: resourceUuidValidator }),
  v.object({ type: v.literal('moved'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({ type: v.literal('trashed'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({ type: v.literal('restored'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({ type: v.literal('permanentlyDeleted'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({
    type: v.literal('deepCopied'),
    roots: v.array(
      v.object({
        sourceRootId: resourceUuidValidator,
        destinationRootId: resourceUuidValidator,
      }),
    ),
  }),
)

export const resourceStructureCommandValidator = v.union(
  v.object({
    type: v.literal('create'),
    resourceId: resourceUuidValidator,
    kind: resourceKindValidator,
    parentId: v.nullable(resourceUuidValidator),
    title: v.string(),
    icon: v.nullable(v.string()),
    color: v.nullable(v.string()),
  }),
  v.object({
    type: v.literal('updateMetadata'),
    resourceId: resourceUuidValidator,
    changes: v.object({
      title: v.optional(v.string()),
      icon: v.optional(v.nullable(v.string())),
      color: v.optional(v.nullable(v.string())),
    }),
  }),
  v.object({
    type: v.literal('move'),
    resourceIds: v.array(resourceUuidValidator),
    destinationParentId: v.nullable(resourceUuidValidator),
  }),
  v.object({ type: v.literal('trash'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({ type: v.literal('restore'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({ type: v.literal('permanentlyDelete'), resourceIds: v.array(resourceUuidValidator) }),
  v.object({
    type: v.literal('deepCopy'),
    sourceRootIds: v.array(resourceUuidValidator),
    destinationParentId: v.nullable(resourceUuidValidator),
  }),
)

export const resourceCommandReceiptValidator = v.object({
  campaignId: campaignUuidValidator,
  operationId: v.string(),
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
    reason: literals('capability_not_supported', 'scope_unavailable'),
  }),
)

export const resourceTables = {
  resources: defineTable(resourceTableValidator)
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid'])
    .index('by_campaign_and_parent', ['campaignUuid', 'parentResourceUuid'])
    .index('by_campaign_and_parent_and_lifecycle_and_resource', [
      'campaignUuid',
      'parentResourceUuid',
      'lifecycle',
      'resourceUuid',
    ]),

  resourceTombstones: defineTable({
    resourceUuid: resourceUuidValidator,
    campaignUuid: campaignUuidValidator,
    deletionVersion: versionStampValidator,
    deletedAt: v.number(),
  })
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid']),

  resourceSourcePathAliases: defineTable({
    campaignUuid: campaignUuidValidator,
    resourceUuid: resourceUuidValidator,
    firstSeenImportJobUuid: v.string(),
    sourceRootId: v.string(),
    rawPath: v.string(),
    normalizedPath: v.string(),
  }).index('by_campaign_and_resource_and_normalizedPath', [
    'campaignUuid',
    'resourceUuid',
    'normalizedPath',
  ]),

  resourceRoles: defineTable({
    campaignUuid: campaignUuidValidator,
    role: v.string(),
    resourceUuid: resourceUuidValidator,
  })
    .index('by_campaign_and_role', ['campaignUuid', 'role'])
    .index('by_campaign_and_resource', ['campaignUuid', 'resourceUuid']),

  resourceOperations: defineTable({
    campaignUuid: campaignUuidValidator,
    actorMemberUuid: campaignMemberUuidValidator,
    operationUuid: v.string(),
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: resourceCommandReceiptValidator,
  })
    .index('by_campaign_and_operation', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_and_actor', ['campaignUuid', 'actorMemberUuid']),

  resourceContentVersions: defineTable({
    campaignUuid: campaignUuidValidator,
    resourceUuid: resourceUuidValidator,
    component: literals(
      RESOURCE_KIND.note,
      RESOURCE_KIND.file,
      RESOURCE_KIND.map,
      RESOURCE_KIND.canvas,
    ),
    version: versionStampValidator,
  }).index('by_resource_and_component', ['resourceUuid', 'component']),
}
