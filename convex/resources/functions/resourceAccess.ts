import {
  RESOURCE_PERMISSION,
  canProjectResource,
  resolveResourceAccess,
  resolveResourcePermission,
  resourcePermissionAllows,
} from '@wizard-archive/editor/resources/access-policy'
import type {
  ResourceAccessNode,
  ResourceAccessParticipant,
  ResourceAccessPolicy,
  ResourcePermission,
} from '@wizard-archive/editor/resources/access-policy'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { resourceRecordFromRow } from './resourceCatalogRow'

type ResourceAccessCtx = Pick<CampaignMutationCtx | CampaignQueryCtx, 'db'>
type LoadResource = (resourceId: ResourceId) => Promise<ResourceRecord | null>
type AccessPolicyResource = Pick<Doc<'resources'>, 'campaignUuid' | 'kind' | 'resourceUuid'>
type AccessParticipantIdentity = Pick<
  ResourceAccessParticipant,
  'id' | 'displayName' | 'username' | 'imageUrl'
>

export function resourceAccessPolicyFromRow(
  row: Doc<'resourceAccessPolicies'>,
): ResourceAccessPolicy {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid)
  return row.subject === 'folder'
    ? {
        resourceId,
        audienceAccess: row.audienceAccess,
        subject: 'folder',
        inheritance: row.inheritance,
      }
    : {
        resourceId,
        audienceAccess: row.audienceAccess,
        subject: 'resource',
      }
}

export async function createInitialResourceAccessPolicy(
  ctx: CampaignMutationCtx,
  resource: AccessPolicyResource,
): Promise<void> {
  const existing = await loadResourceAccessPolicy(
    ctx,
    assertDomainId(DOMAIN_ID_KIND.campaign, resource.campaignUuid),
    resource.resourceUuid,
  )
  if (existing) throw new TypeError('Resource access policy already exists')
  await ctx.db.insert(
    'resourceAccessPolicies',
    resource.kind === 'folder'
      ? {
          campaignUuid: resource.campaignUuid,
          resourceUuid: resource.resourceUuid,
          audienceAccess: { state: 'default' },
          subject: 'folder',
          inheritance: ctx.campaign.resourceAccessDefaults.folderInheritance,
        }
      : {
          campaignUuid: resource.campaignUuid,
          resourceUuid: resource.resourceUuid,
          audienceAccess: { state: 'default' },
          subject: 'resource',
        },
  )
}

export async function copyResourceAccessPolicy(
  ctx: CampaignMutationCtx,
  source: AccessPolicyResource,
  destination: AccessPolicyResource,
): Promise<void> {
  const sourcePolicy = await loadResourceAccessPolicy(
    ctx,
    assertDomainId(DOMAIN_ID_KIND.campaign, source.campaignUuid),
    source.resourceUuid,
  )
  if (
    !sourcePolicy ||
    sourcePolicy.subject !== (source.kind === 'folder' ? 'folder' : 'resource') ||
    destination.kind !== source.kind
  ) {
    throw new TypeError('Resource access policy is missing or corrupt')
  }
  await ctx.db.insert(
    'resourceAccessPolicies',
    sourcePolicy.subject === 'folder'
      ? {
          campaignUuid: destination.campaignUuid,
          resourceUuid: destination.resourceUuid,
          audienceAccess: { state: 'default' },
          subject: 'folder',
          inheritance: sourcePolicy.inheritance,
        }
      : {
          campaignUuid: destination.campaignUuid,
          resourceUuid: destination.resourceUuid,
          audienceAccess: { state: 'default' },
          subject: 'resource',
        },
  )
}

export function createResourceAccessResolver(
  ctx: ResourceAccessCtx,
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  loadResource: LoadResource = async (resourceId) => {
    const row = await findCanonicalResource(ctx.db, resourceId)
    return row ? resourceRecordFromRow(row) : null
  },
) {
  const nodes = new Map<ResourceId, ResourceAccessNode>()
  const resources = new Map<ResourceId, ResourceRecord>()

  const loadNode = async (resource: ResourceRecord) => {
    const resourceId = resource.id
    const known = nodes.get(resourceId)
    if (known) return known
    const [policyRow, memberRow] = await Promise.all([
      loadResourceAccessPolicy(ctx, campaignId, resourceId),
      ctx.db
        .query('resourceMemberAccess')
        .withIndex('by_resource_and_member', (query) =>
          query
            .eq('campaignUuid', campaignId)
            .eq('resourceUuid', resourceId)
            .eq('memberUuid', memberId),
        )
        .unique(),
    ])
    if (!policyRow || policyRow.subject !== (resource.kind === 'folder' ? 'folder' : 'resource')) {
      return null
    }
    const node: ResourceAccessNode = {
      policy: resourceAccessPolicyFromRow(policyRow),
      parentId: resource.parentId,
      memberAccess: memberRow
        ? { state: 'explicit', permission: memberRow.permission }
        : { state: 'default' },
    }
    resources.set(resourceId, resource)
    nodes.set(resourceId, node)
    return node
  }

  const loadSpine = async (resource: ResourceRecord) => {
    const visited = new Set<ResourceId>()
    let current: ResourceRecord | null = resource
    while (current) {
      const resourceId = current.id
      if (visited.has(resourceId) || visited.size >= MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
        return false
      }
      visited.add(resourceId)
      if (current.campaignId !== campaignId || !(await loadNode(current))) {
        return false
      }
      const parentId: ResourceId | null = current.parentId
      current =
        parentId === null ? null : (resources.get(parentId) ?? (await loadResource(parentId)))
    }
    return true
  }

  return {
    async permission(resource: ResourceRecord): Promise<ResourcePermission> {
      if (!(await loadSpine(resource))) return RESOURCE_PERMISSION.none
      return resolveResourcePermission(resource.id, nodes)
    },
    async canProject(resource: ResourceRecord): Promise<boolean> {
      if (!(await loadSpine(resource))) return false
      return canProjectResource(resource.id, nodes)
    },
  }
}

export async function authorizeResourcePermission(
  ctx: CampaignMutationCtx | CampaignQueryCtx,
  resourceId: ResourceId,
  required: Exclude<ResourcePermission, 'none'>,
) {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (
    !resource ||
    resource.campaignUuid !== ctx.resourceScope.campaignId ||
    resource.lifecycle !== 'active'
  ) {
    return { status: 'unauthorized' as const }
  }
  if (ctx.resourceScope.projection === 'dm') {
    return { status: 'authorized' as const, resource, permission: RESOURCE_PERMISSION.edit }
  }
  const resolver = createResourceAccessResolver(
    ctx,
    ctx.resourceScope.campaignId,
    ctx.resourceScope.actorId,
  )
  const record = resourceRecordFromRow(resource)
  const permission = await resolver.permission(record)
  if (!(await resolver.canProject(record)) || !resourcePermissionAllows(permission, required)) {
    return { status: 'unauthorized' as const }
  }
  return { status: 'authorized' as const, resource, permission }
}

export async function loadResourceAccessPolicy(
  ctx: ResourceAccessCtx,
  campaignId: CampaignId,
  resourceId: ResourceId | string,
) {
  return await ctx.db
    .query('resourceAccessPolicies')
    .withIndex('by_campaign_and_resource', (query) =>
      query.eq('campaignUuid', campaignId).eq('resourceUuid', resourceId),
    )
    .unique()
}

export async function projectResourceAccess(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  participants: ReadonlyArray<AccessParticipantIdentity>,
) {
  const spine = await loadResourceAccessSpine(ctx, resourceId)
  if (!spine) return null
  const { defaultNodes, memberPermissions } = await loadResourceAccessProjection(
    ctx,
    spine,
    participants,
  )
  return {
    policy: defaultNodes.get(resourceId)!.policy,
    defaultAccess: resolveResourceAccess(resourceId, defaultNodes),
    participants: participants.map((participant) =>
      projectParticipantAccess(participant, resourceId, spine, defaultNodes, memberPermissions),
    ),
  }
}

async function loadResourceAccessSpine(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
): Promise<Array<ResourceRecord> | null> {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (
    !resource ||
    resource.campaignUuid !== ctx.resourceScope.campaignId ||
    resource.lifecycle !== 'active'
  ) {
    return null
  }
  const spine = [resourceRecordFromRow(resource)]
  const visited = new Set<ResourceId>([resourceId])
  let current = spine[0]!
  while (current.parentId !== null) {
    const parentId = current.parentId
    if (visited.has(parentId) || visited.size >= MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new TypeError('Resource access hierarchy is invalid')
    }
    const parent = await findCanonicalResource(ctx.db, parentId)
    if (!parent || parent.campaignUuid !== ctx.resourceScope.campaignId) {
      throw new TypeError('Resource access hierarchy is incomplete')
    }
    visited.add(parentId)
    current = resourceRecordFromRow(parent)
    spine.push(current)
  }
  return spine
}

async function loadResourceAccessProjection(
  ctx: CampaignQueryCtx,
  spine: ReadonlyArray<ResourceRecord>,
  participants: ReadonlyArray<AccessParticipantIdentity>,
) {
  const policies = await Promise.all(
    spine.map((record) => loadResourceAccessPolicy(ctx, ctx.resourceScope.campaignId, record.id)),
  )
  const memberRows = (
    await Promise.all(
      participants.flatMap((participant) =>
        spine.map((record) =>
          ctx.db
            .query('resourceMemberAccess')
            .withIndex('by_resource_and_member', (query) =>
              query
                .eq('campaignUuid', ctx.resourceScope.campaignId)
                .eq('resourceUuid', record.id)
                .eq('memberUuid', participant.id),
            )
            .unique(),
        ),
      ),
    )
  ).filter((row) => row !== null)
  const memberPermissions = new Map(
    memberRows.map((row) => [memberAccessKey(row.resourceUuid, row.memberUuid), row.permission]),
  )
  const defaultNodes = new Map<ResourceId, ResourceAccessNode>()
  for (const [index, record] of spine.entries()) {
    const policy = policies[index]
    if (!policy || policy.subject !== (record.kind === 'folder' ? 'folder' : 'resource')) {
      throw new TypeError('Resource access policy is missing or corrupt')
    }
    defaultNodes.set(record.id, {
      policy: resourceAccessPolicyFromRow(policy),
      parentId: record.parentId,
      memberAccess: { state: 'default' },
    })
  }
  return { defaultNodes, memberPermissions }
}

function projectParticipantAccess(
  participant: AccessParticipantIdentity,
  resourceId: ResourceId,
  spine: ReadonlyArray<ResourceRecord>,
  defaultNodes: ReadonlyMap<ResourceId, ResourceAccessNode>,
  memberPermissions: ReadonlyMap<string, ResourcePermission>,
): ResourceAccessParticipant {
  const nodes = new Map(defaultNodes)
  for (const record of spine) {
    const permission = memberPermissions.get(memberAccessKey(record.id, participant.id))
    if (!permission) continue
    const node = nodes.get(record.id)!
    nodes.set(record.id, {
      ...node,
      memberAccess: { state: 'explicit', permission },
    })
  }
  return {
    ...participant,
    access: nodes.get(resourceId)!.memberAccess,
    effectiveAccess: resolveResourceAccess(resourceId, nodes),
  }
}

function memberAccessKey(resourceId: ResourceId | string, memberId: CampaignMemberId | string) {
  return `${resourceId}:${memberId}`
}
