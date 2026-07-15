import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'

const NOTE_AWARENESS_TTL_MS = 30_000
const MAX_NOTE_AWARENESS_CLIENTS = 256
const NOTE_AWARENESS_CLEANUP_BATCH_SIZE = 64

export async function loadNoteAwareness(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'note')
  if (authorization.status !== 'authorized') return authorization

  const activeAfter = Date.now() - NOTE_AWARENESS_TTL_MS
  const rows = await ctx.db
    .query('resourceNoteAwareness')
    .withIndex('by_resourceUuid_and_updatedAt', (query) =>
      query.eq('resourceUuid', resourceId).gte('updatedAt', activeAfter),
    )
    .take(MAX_NOTE_AWARENESS_CLIENTS)

  return {
    status: 'ready' as const,
    entries: rows.map((row) => ({
      clientId: row.clientId,
      memberId: row.memberUuid,
      state: row.state,
    })),
  }
}

export async function publishNoteAwareness(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; leaseId: string; state: ArrayBuffer },
) {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'note')
  if (authorization.status !== 'authorized') return { status: 'unavailable' as const }

  const now = Date.now()
  const expired = await ctx.db
    .query('resourceNoteAwareness')
    .withIndex('by_resourceUuid_and_updatedAt', (query) =>
      query.eq('resourceUuid', args.resourceId).lt('updatedAt', now - NOTE_AWARENESS_TTL_MS),
    )
    .take(NOTE_AWARENESS_CLEANUP_BATCH_SIZE)
  await Promise.all(expired.map((row) => ctx.db.delete(row._id)))
  const existing = await findNoteAwarenessClient(ctx, args.resourceId, args.clientId)
  if (
    existing &&
    existing.updatedAt >= now - NOTE_AWARENESS_TTL_MS &&
    (existing.memberUuid !== ctx.resourceScope.actorId || existing.leaseId !== args.leaseId)
  ) {
    return { status: 'rejected' as const, reason: 'lease_conflict' as const }
  }

  const value = {
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: args.resourceId,
    memberUuid: ctx.resourceScope.actorId,
    clientId: args.clientId,
    leaseId: args.leaseId,
    state: args.state,
    updatedAt: now,
  }
  if (existing) await ctx.db.replace('resourceNoteAwareness', existing._id, value)
  else await ctx.db.insert('resourceNoteAwareness', value)
  return { status: 'active' as const }
}

export async function releaseNoteAwareness(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; leaseId: string },
) {
  const existing = await findNoteAwarenessClient(ctx, args.resourceId, args.clientId)
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

async function findNoteAwarenessClient(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  clientId: number,
) {
  return await ctx.db
    .query('resourceNoteAwareness')
    .withIndex('by_resourceUuid_and_clientId', (query) =>
      query.eq('resourceUuid', resourceId).eq('clientId', clientId),
    )
    .unique()
}
