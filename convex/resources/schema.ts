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

export const resourceCommandReceiptValidator = v.object({
  campaignId: campaignUuidValidator,
  operationId: v.string(),
  result: resourceStructureResultValidator,
  postconditions: v.array(resourcePostconditionValidator),
})

export const resourceTables = {
  resources: defineTable(resourceTableValidator)
    .index('by_resourceUuid', ['resourceUuid'])
    .index('by_campaign_parent_lifecycle_resourceUuid', [
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
    .index('by_campaign_resourceUuid', ['campaignUuid', 'resourceUuid']),

  resourceSourcePathAliases: defineTable({
    campaignUuid: campaignUuidValidator,
    resourceUuid: resourceUuidValidator,
    firstSeenImportJobUuid: v.string(),
    sourceRootId: v.string(),
    rawPath: v.string(),
    normalizedPath: v.string(),
  }).index('by_campaign_resource_normalizedPath', [
    'campaignUuid',
    'resourceUuid',
    'normalizedPath',
  ]),

  resourceRoles: defineTable({
    campaignUuid: campaignUuidValidator,
    role: v.string(),
    resourceUuid: resourceUuidValidator,
  })
    .index('by_campaign_role', ['campaignUuid', 'role'])
    .index('by_campaign_resourceUuid', ['campaignUuid', 'resourceUuid']),

  resourceOperations: defineTable({
    campaignUuid: campaignUuidValidator,
    actorMemberUuid: campaignMemberUuidValidator,
    operationUuid: v.string(),
    protocolVersion: v.literal(RESOURCE_COMMAND_PROTOCOL_VERSION),
    fingerprint: v.string(),
    receipt: resourceCommandReceiptValidator,
  })
    .index('by_campaign_operationUuid', ['campaignUuid', 'operationUuid'])
    .index('by_campaign_actorMemberUuid', ['campaignUuid', 'actorMemberUuid']),

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
  }).index('by_resourceUuid_component', ['resourceUuid', 'component']),
}
