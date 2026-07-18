import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import { authQuery, dmQuery, resourceQuery } from '../functions'
import {
  loadAuthorizedCollection,
  loadAuthorizedResource,
  loadAuthorizedResourceProjection,
} from './functions/projectAuthorizedResources'
import {
  authorizedResourceSnapshotValidator,
  canvasContentSnapshotValidator,
  fileContentSnapshotValidator,
  fileDownloadSnapshotValidator,
  mapContentSnapshotValidator,
  mapImageDownloadSnapshotValidator,
  noteBlockAccessPresentationValidator,
  noteContentSnapshotValidator,
  resourcePresenceSnapshotValidator,
  resourceAccessPresentationValidator,
  resourceCollectionQueryValidator,
  workspaceSearchResultValidator,
} from './schema'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { loadNoteContent as loadNoteContentFn } from './functions/loadNoteContent'
import { loadResourcePresence as loadResourcePresenceFn } from './functions/resourcePresence'
import { loadCanvasContent as loadCanvasContentFn } from './functions/canvasContent'
import { loadFileContent as loadFileContentFn } from './functions/fileContent'
import { loadMapContent as loadMapContentFn } from './functions/mapContent'
import { importJobIdValidator, resourceIdValidator } from './validators'
import { searchResources as searchResourcesFn } from './functions/searchResources'
import { loadActorBookmarks } from './functions/resourceBookmarks'
import { loadFileDownload as loadFileDownloadFn } from './functions/loadFileDownload'
import { loadPlainFileTransfer as loadPlainFileTransferFn } from './functions/plainFileTransfer'
import { loadMapImage as loadMapImageFn } from './functions/loadMapImage'
import { projectResourceAccess } from './functions/resourceAccess'
import { getCampaignMembers } from '../campaigns/functions/getCampaignMembers'
import { projectNoteBlockAccess } from './functions/noteBlockAccess'
import { campaignIdValidator, campaignMemberIdValidator } from '../campaigns/schema'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../../shared/campaigns/types'

type StoredAuthorizedResourceSnapshot = Infer<typeof authorizedResourceSnapshotValidator>
type StoredNoteBlockAccessPresentation = Infer<typeof noteBlockAccessPresentationValidator>

const authorizedResourceCollectionPageValidator = v.object({
  snapshot: authorizedResourceSnapshotValidator,
  cursor: v.nullable(v.string()),
})

const authorizedResourceBookmarksValidator = v.object({
  resourceIds: v.array(resourceIdValidator),
  snapshot: authorizedResourceSnapshotValidator,
})

const authorizedResourceSearchValidator = v.object({
  status: v.union(v.literal('complete'), v.literal('incomplete')),
  results: v.array(workspaceSearchResultValidator),
  snapshot: authorizedResourceSnapshotValidator,
})

const plainFileTransferSnapshotValidator = v.union(
  v.object({ status: v.literal('unavailable') }),
  v.object({
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('cancelled'),
      v.literal('rejected'),
    ),
    jobId: importJobIdValidator,
    operationId: v.string(),
    destinationParentId: v.nullable(resourceIdValidator),
    sourceDigest: v.nullable(v.string()),
    rejectionReason: v.nullable(v.string()),
    entry: v.object({
      sourceRootId: v.string(),
      rawPath: v.string(),
      normalizedPath: v.string(),
      sourceDigest: v.nullable(v.string()),
      resourceId: v.nullable(resourceIdValidator),
      status: v.union(
        v.literal('pending'),
        v.literal('completed'),
        v.literal('cancelled'),
        v.literal('rejected'),
      ),
      rejectionReason: v.nullable(v.string()),
    }),
  }),
)

type StoredAuthorizedResourceCollectionPage = Infer<
  typeof authorizedResourceCollectionPageValidator
>

function storedSnapshot(
  snapshot: Awaited<ReturnType<typeof loadAuthorizedResource>>,
): StoredAuthorizedResourceSnapshot {
  if (snapshot.scope.projection === 'local') {
    throw new TypeError('A local resource projection cannot cross the Convex boundary')
  }
  return {
    scope: {
      campaignId: snapshot.scope.campaignId,
      actorId: snapshot.scope.actorId,
      projection: snapshot.scope.projection,
      schema: snapshot.scope.schema,
    },
    revision: snapshot.revision,
    resources: snapshot.resources.map((resource) => ({
      ...resource,
      metadataVersion: { ...resource.metadataVersion },
    })),
    missingResourceIds: [...snapshot.missingResourceIds],
    collections: snapshot.collections.map((collection) => ({
      query: {
        parentId: collection.query.parentId,
        lifecycle: collection.query.lifecycle,
        ...(collection.query.kinds === undefined ? {} : { kinds: [...collection.query.kinds] }),
      },
      resourceIds: [...collection.resourceIds],
      complete: collection.complete,
    })),
  }
}

export const loadResource = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: authorizedResourceSnapshotValidator,
  handler: async (ctx, args): Promise<StoredAuthorizedResourceSnapshot> => {
    return storedSnapshot(
      await loadAuthorizedResource(ctx, assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)),
    )
  },
})

export const loadCollection = resourceQuery({
  args: {
    query: resourceCollectionQueryValidator,
    cursor: v.optional(v.nullable(v.string())),
  },
  returns: authorizedResourceCollectionPageValidator,
  handler: async (ctx, args): Promise<StoredAuthorizedResourceCollectionPage> => {
    const page = await loadAuthorizedCollection(ctx, {
      query: {
        parentId:
          args.query.parentId === null
            ? null
            : assertDomainId(DOMAIN_ID_KIND.resource, args.query.parentId),
        lifecycle: args.query.lifecycle,
        ...(args.query.kinds === undefined ? {} : { kinds: args.query.kinds }),
      },
      cursor: args.cursor ?? null,
    })
    return { snapshot: storedSnapshot(page.snapshot), cursor: page.cursor }
  },
})

export const loadResourceProjectionAvailability = authQuery({
  args: {
    campaignId: campaignIdValidator,
    actorId: campaignMemberIdValidator,
    projection: v.union(v.literal('dm'), v.literal('player'), v.literal('view_as_player')),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', args.campaignId))
      .unique()
    if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted) return false
    const requester = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (query) =>
        query.eq('campaignId', campaign._id).eq('userId', ctx.user.profile._id),
      )
      .unique()
    if (!requester || requester.status !== CAMPAIGN_MEMBER_STATUS.Accepted) return false
    if (args.projection !== 'view_as_player') {
      return (
        requester.campaignMemberUuid === args.actorId &&
        requester.role ===
          (args.projection === 'dm' ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player)
      )
    }
    if (requester.role !== CAMPAIGN_MEMBER_ROLE.DM) return false
    const participant = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaignMemberUuid', (query) => query.eq('campaignMemberUuid', args.actorId))
      .unique()
    return (
      participant?.campaignId === campaign._id &&
      participant.role === CAMPAIGN_MEMBER_ROLE.Player &&
      participant.status === CAMPAIGN_MEMBER_STATUS.Accepted
    )
  },
})

export const loadPlainFileTransfer = dmQuery({
  args: { jobId: importJobIdValidator },
  returns: plainFileTransferSnapshotValidator,
  handler: async (ctx, args) =>
    await loadPlainFileTransferFn(ctx, assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId)),
})

export const loadResourceAccess = dmQuery({
  args: { resourceId: resourceIdValidator },
  returns: v.nullable(resourceAccessPresentationValidator),
  handler: async (ctx, args) => {
    const members = await getCampaignMembers(ctx)
    const participants = []
    for (const member of members) {
      if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) continue
      participants.push({
        id: member.id,
        displayName: member.userProfile.name?.trim() || member.userProfile.username,
        username: member.userProfile.username,
        imageUrl: member.userProfile.imageUrl,
      })
    }
    const presentation = await projectResourceAccess(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      participants,
    )
    return presentation
      ? {
          ...presentation,
          participants: [...presentation.participants],
        }
      : null
  },
})

export const loadNoteBlockAccess = dmQuery({
  args: { noteId: resourceIdValidator },
  returns: v.nullable(noteBlockAccessPresentationValidator),
  handler: async (ctx, args): Promise<StoredNoteBlockAccessPresentation | null> => {
    const members = await getCampaignMembers(ctx)
    const participants = members.flatMap((member) =>
      member.role === CAMPAIGN_MEMBER_ROLE.Player
        ? [
            {
              id: member.id,
              displayName: member.userProfile.name?.trim() || member.userProfile.username,
              username: member.userProfile.username,
              imageUrl: member.userProfile.imageUrl,
            },
          ]
        : [],
    )
    const presentation = await projectNoteBlockAccess(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.noteId),
      participants,
    )
    return presentation
      ? {
          noteId: presentation.noteId,
          blocks: presentation.blocks.map((block) => ({
            blockId: block.blockId,
            audienceVisibility: block.audienceVisibility,
            memberAccess: block.memberAccess.map((access) => ({ ...access })),
          })),
          participants: presentation.participants.map((participant) => ({ ...participant })),
        }
      : null
  },
})

export const loadNoteContent = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: noteContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadNoteContentFn(ctx, resourceId)
  },
})

export const loadResourcePresence = resourceQuery({
  args: { resourceId: resourceIdValidator, roomToken: v.string() },
  returns: resourcePresenceSnapshotValidator,
  handler: async (ctx, args) =>
    await loadResourcePresenceFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      args.roomToken,
    ),
})

export const loadFileContent = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: fileContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadFileContentFn(ctx, resourceId)
  },
})

export const loadMapContent = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: mapContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadMapContentFn(ctx, resourceId)
  },
})

export const loadCanvasContent = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: canvasContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadCanvasContentFn(ctx, resourceId)
  },
})

export const loadFileDownload = resourceQuery({
  args: { resourceId: resourceIdValidator },
  returns: fileDownloadSnapshotValidator,
  handler: async (ctx, args) => {
    return await loadFileDownloadFn(ctx, assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId))
  },
})

export const loadMapImage = resourceQuery({
  args: { resourceId: resourceIdValidator, layerId: v.nullable(v.string()) },
  returns: mapImageDownloadSnapshotValidator,
  handler: async (ctx, args) => {
    return await loadMapImageFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      args.layerId,
    )
  },
})

export const loadBookmarks = dmQuery({
  args: {},
  returns: authorizedResourceBookmarksValidator,
  handler: async (ctx) => {
    const rows = await loadActorBookmarks(ctx)
    const resourceIds = rows.map((row) => assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid))
    return {
      resourceIds,
      snapshot: storedSnapshot(await loadAuthorizedResourceProjection(ctx, resourceIds)),
    }
  },
})

export const searchResources = dmQuery({
  args: { query: v.string() },
  returns: authorizedResourceSearchValidator,
  handler: async (ctx, args) => {
    const outcome = await searchResourcesFn(ctx, args.query)
    const results = outcome.results.map((result) => ({
      resourceId: result.resourceId,
      match: result.match.type === 'title' ? { type: 'title' as const } : { ...result.match },
    }))
    return {
      status: outcome.status,
      results,
      snapshot: storedSnapshot(
        await loadAuthorizedResourceProjection(
          ctx,
          results.map((result) => result.resourceId),
        ),
      ),
    }
  },
})
