import type { Infer } from 'convex/values'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignMemberId,
  HistoryEntryId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ItemHistoryEntry } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import type { itemHistoryPageValidator, itemHistoryPreviewResultValidator } from '../schema'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import { projectMapContent } from './mapContent'
import { authorizeResourcePermission } from './resourceAccess'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import { findItemHistoryCheckpoint } from './findItemHistoryCheckpoint'

const ITEM_HISTORY_PAGE_SIZE = 25

type ItemHistoryPage = Infer<typeof itemHistoryPageValidator>
type ItemHistoryPreviewResult = Infer<typeof itemHistoryPreviewResultValidator>

export async function loadItemHistoryPage(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  cursor: string | null,
): Promise<ItemHistoryPage> {
  const authorization = await authorizeResourcePermission(ctx, resourceId, 'edit')
  if (authorization.status !== 'authorized') return { status: 'unavailable' }

  const page = await ctx.db
    .query('itemHistoryEntries')
    .withIndex('by_resource_history', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('resourceUuid', resourceId),
    )
    .order('desc')
    .paginate({ cursor, numItems: ITEM_HISTORY_PAGE_SIZE })
  const actorIds = [...new Set(page.page.map((entry) => entry.actorMemberUuid))]
  const actors = new Map(
    await Promise.all(
      actorIds.map(async (actorId) => [actorId, await loadHistoryActor(ctx, actorId)] as const),
    ),
  )
  return {
    status: 'ready',
    entries: page.page.map((entry) =>
      presentHistoryEntry(entry, actors.get(entry.actorMemberUuid)!),
    ),
    nextCursor: page.isDone ? null : page.continueCursor,
  }
}

export async function loadItemHistoryCheckpoint(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  entryId: HistoryEntryId,
): Promise<ItemHistoryPreviewResult> {
  const authorization = await authorizeResourceContentKinds(
    ctx,
    resourceId,
    ['note', 'canvas', 'map'],
    'edit',
  )
  if (authorization.status !== 'authorized') return { status: 'unavailable' }

  const lookup = await findItemHistoryCheckpoint(
    ctx.db,
    ctx.resourceScope.campaignId,
    resourceId,
    entryId,
    authorization.resource.kind,
  )
  if (lookup.status !== 'ready') return { status: 'unavailable' }
  const { checkpoint } = lookup

  try {
    return checkpoint.kind === 'map'
      ? {
          status: 'ready',
          preview: {
            kind: 'map',
            snapshotId: assertDomainId(DOMAIN_ID_KIND.snapshot, checkpoint.snapshotUuid),
            version: assertVersionStamp(checkpoint.version),
            content: projectMapContent(checkpoint, checkpoint.pins),
          },
        }
      : {
          status: 'ready',
          preview: {
            kind: checkpoint.kind,
            snapshotId: assertDomainId(DOMAIN_ID_KIND.snapshot, checkpoint.snapshotUuid),
            version: assertVersionStamp(checkpoint.version),
            update: checkpoint.update,
          },
        }
  } catch {
    return { status: 'unavailable' }
  }
}

async function loadHistoryActor(
  ctx: CampaignQueryCtx,
  actorMemberUuid: CampaignMemberId,
): Promise<ItemHistoryEntry['actor']> {
  const id = assertDomainId(DOMAIN_ID_KIND.campaignMember, actorMemberUuid)
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaignMemberUuid', (query) => query.eq('campaignMemberUuid', actorMemberUuid))
    .unique()
  const profile =
    member?.campaignId === ctx.campaign._id
      ? await getUserProfileById(ctx, { profileId: member.userId })
      : null
  return profile
    ? {
        id,
        displayName: profile.name?.trim() || profile.username,
        imageUrl: profile.imageUrl,
      }
    : { id, displayName: 'Former member', imageUrl: null }
}

function presentHistoryEntry(
  entry: Doc<'itemHistoryEntries'>,
  actor: ItemHistoryEntry['actor'],
): ItemHistoryEntry {
  const base = {
    id: assertDomainId(DOMAIN_ID_KIND.historyEntry, entry.historyEntryUuid),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceUuid),
    actor,
    action: entry.action,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
  }
  return (
    'checkpoint' in entry
      ? {
          ...base,
          checkpoint: {
            ...entry.checkpoint,
            snapshotId: assertDomainId(DOMAIN_ID_KIND.snapshot, entry.checkpoint.snapshotId),
            version: assertVersionStamp(entry.checkpoint.version),
          },
        }
      : base
  ) as ItemHistoryEntry
}
