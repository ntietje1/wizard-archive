import {
  RESOURCE_PERMISSION,
  canProjectResource,
  resolveResourcePermission,
  resourcePermissionAllows,
} from '@wizard-archive/editor/resources/access-policy'
import type {
  ResourceAccessNode,
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
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { resourceRecordFromRow } from './resourceRecordRow'

type ResourceAccessCtx = Pick<CampaignMutationCtx | CampaignQueryCtx, 'db'>
type LoadResource = (resourceId: ResourceId) => Promise<ResourceRecord | null>
type AccessPolicyResource = Pick<Doc<'resources'>, 'campaignUuid' | 'kind' | 'resourceUuid'>

export function resourceAccessPolicyFromRow(
  row: Doc<'resourceAccessPolicies'>,
): ResourceAccessPolicy {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid)
  return row.subject === 'folder'
    ? {
        resourceId,
        audiencePermission: row.audiencePermission,
        subject: 'folder',
        inheritance: row.inheritance,
      }
    : {
        resourceId,
        audiencePermission: row.audiencePermission,
        subject: 'resource',
      }
}

export async function createInitialResourceAccessPolicy(
  ctx: CampaignMutationCtx,
  resource: AccessPolicyResource,
): Promise<void> {
  const existing = await loadResourceAccessPolicy(ctx, resource.campaignUuid, resource.resourceUuid)
  if (existing) throw new TypeError('Resource access policy already exists')
  await ctx.db.insert(
    'resourceAccessPolicies',
    resource.kind === 'folder'
      ? {
          campaignUuid: resource.campaignUuid,
          resourceUuid: resource.resourceUuid,
          audiencePermission: RESOURCE_PERMISSION.none,
          subject: 'folder',
          inheritance: ctx.campaign.resourceAccessDefaults.folderInheritance,
        }
      : {
          campaignUuid: resource.campaignUuid,
          resourceUuid: resource.resourceUuid,
          audiencePermission: RESOURCE_PERMISSION.none,
          subject: 'resource',
        },
  )
}

export async function copyResourceAccessPolicy(
  ctx: CampaignMutationCtx,
  source: AccessPolicyResource,
  destination: AccessPolicyResource,
): Promise<void> {
  const sourcePolicy = await loadResourceAccessPolicy(ctx, source.campaignUuid, source.resourceUuid)
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
          audiencePermission: RESOURCE_PERMISSION.none,
          subject: 'folder',
          inheritance: sourcePolicy.inheritance,
        }
      : {
          campaignUuid: destination.campaignUuid,
          resourceUuid: destination.resourceUuid,
          audiencePermission: RESOURCE_PERMISSION.none,
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
  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
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
