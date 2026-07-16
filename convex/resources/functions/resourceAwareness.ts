import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import { internal } from '../../_generated/api'
import {
  MAX_RESOURCE_AWARENESS_CLIENTS,
  RESOURCE_AWARENESS_TTL_MS,
  authenticateResourceAwarenessUpdate,
  collaborationColor,
  validateResourceAwarenessIdentity,
} from '../../../shared/resources/resource-awareness-protocol'

export async function loadResourceAwareness(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContentKinds(ctx, resourceId, ['note', 'canvas'])
  if (authorization.status !== 'authorized') return authorization

  const activeAfter = Date.now() - RESOURCE_AWARENESS_TTL_MS
  const rows = await ctx.db
    .query('resourceAwareness')
    .withIndex('by_resourceUuid_and_updatedAt', (query) =>
      query.eq('resourceUuid', resourceId).gte('updatedAt', activeAfter),
    )
    .take(MAX_RESOURCE_AWARENESS_CLIENTS + 1)

  if (rows.length > MAX_RESOURCE_AWARENESS_CLIENTS) {
    return { status: 'unavailable' as const, reason: 'capacity_exceeded' as const }
  }

  return {
    status: 'ready' as const,
    entries: rows.map((row) => ({
      clientId: row.clientId,
      memberId: row.memberUuid,
      state: row.state,
    })),
  }
}

export async function publishResourceAwareness(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; leaseId: string; state: ArrayBuffer },
) {
  const authorization = await authorizeResourceContentKinds(ctx, args.resourceId, [
    'note',
    'canvas',
  ])
  if (authorization.status !== 'authorized') return { status: 'unavailable' as const }

  if (!validateResourceAwarenessIdentity(args.clientId, args.leaseId)) {
    return { status: 'rejected' as const, reason: 'invalid_update' as const }
  }
  const memberId = ctx.resourceScope.actorId
  const profile = await ctx.db.get('userProfiles', ctx.membership.userId)
  if (!profile) return { status: 'unavailable' as const }
  const user = {
    name: profile.name?.trim() || profile.username,
    color: collaborationColor(memberId),
  }
  const authenticated = authenticateResourceAwarenessUpdate(
    args.state,
    args.clientId,
    memberId,
    user,
  )
  if (authenticated.status === 'rejected') return authenticated

  const now = Date.now()
  const existing = await findResourceAwarenessClient(ctx, args.resourceId, args.clientId)
  const existingIsActive = existing && existing.updatedAt >= now - RESOURCE_AWARENESS_TTL_MS
  if (
    existingIsActive &&
    (existing.memberUuid !== ctx.resourceScope.actorId || existing.leaseId !== args.leaseId)
  ) {
    return { status: 'rejected' as const, reason: 'lease_conflict' as const }
  }
  const startsLease = !existingIsActive
  if (startsLease) {
    const active = await ctx.db
      .query('resourceAwareness')
      .withIndex('by_resourceUuid_and_updatedAt', (query) =>
        query.eq('resourceUuid', args.resourceId).gte('updatedAt', now - RESOURCE_AWARENESS_TTL_MS),
      )
      .take(MAX_RESOURCE_AWARENESS_CLIENTS)
    if (active.length >= MAX_RESOURCE_AWARENESS_CLIENTS) {
      return { status: 'rejected' as const, reason: 'capacity_exceeded' as const }
    }
  }

  const value = {
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: args.resourceId,
    memberUuid: ctx.resourceScope.actorId,
    clientId: args.clientId,
    leaseId: args.leaseId,
    state: authenticated.update,
    updatedAt: now,
  }
  if (existing) await ctx.db.replace('resourceAwareness', existing._id, value)
  else await ctx.db.insert('resourceAwareness', value)
  if (startsLease) {
    await ctx.scheduler.runAfter(
      RESOURCE_AWARENESS_TTL_MS,
      internal.resources.internalMutations.expireResourceAwarenessLease,
      { resourceId: args.resourceId, clientId: args.clientId, leaseId: args.leaseId },
    )
  }
  return { status: 'active' as const }
}

export async function releaseResourceAwareness(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; leaseId: string },
) {
  const existing = await findResourceAwarenessClient(ctx, args.resourceId, args.clientId)
  if (!existing) return { status: 'unavailable' as const }
  if (
    existing.campaignUuid !== ctx.resourceScope.campaignId ||
    existing.memberUuid !== ctx.resourceScope.actorId ||
    existing.leaseId !== args.leaseId
  ) {
    return { status: 'rejected' as const, reason: 'lease_conflict' as const }
  }
  await ctx.db.delete(existing._id)
  return { status: 'released' as const }
}

async function findResourceAwarenessClient(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  clientId: number,
) {
  return await ctx.db
    .query('resourceAwareness')
    .withIndex('by_resourceUuid_and_clientId', (query) =>
      query.eq('resourceUuid', resourceId).eq('clientId', clientId),
    )
    .unique()
}
