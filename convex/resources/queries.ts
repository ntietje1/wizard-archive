import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import { campaignQuery, dmQuery } from '../functions'
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
import { resourceIdValidator } from './validators'
import { searchResources as searchResourcesFn } from './functions/searchResources'
import { loadActorBookmarks } from './functions/resourceBookmarks'
import { loadFileDownload as loadFileDownloadFn } from './functions/loadFileDownload'
import { loadMapImage as loadMapImageFn } from './functions/loadMapImage'
import { projectResourceAccess } from './functions/resourceAccess'
import { getCampaignMembers } from '../campaigns/functions/getCampaignMembers'
import { CAMPAIGN_MEMBER_ROLE } from '../../shared/campaigns/types'

type StoredAuthorizedResourceSnapshot = Infer<typeof authorizedResourceSnapshotValidator>

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

export const loadResource = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: authorizedResourceSnapshotValidator,
  handler: async (ctx, args): Promise<StoredAuthorizedResourceSnapshot> => {
    return storedSnapshot(
      await loadAuthorizedResource(ctx, assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)),
    )
  },
})

export const loadCollection = campaignQuery({
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

export const loadNoteContent = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: noteContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadNoteContentFn(ctx, resourceId)
  },
})

export const loadResourcePresence = campaignQuery({
  args: { resourceId: resourceIdValidator, roomToken: v.string() },
  returns: resourcePresenceSnapshotValidator,
  handler: async (ctx, args) =>
    await loadResourcePresenceFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      args.roomToken,
    ),
})

export const loadFileContent = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: fileContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadFileContentFn(ctx, resourceId)
  },
})

export const loadMapContent = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: mapContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadMapContentFn(ctx, resourceId)
  },
})

export const loadCanvasContent = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: canvasContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadCanvasContentFn(ctx, resourceId)
  },
})

export const loadFileDownload = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: fileDownloadSnapshotValidator,
  handler: async (ctx, args) => {
    return await loadFileDownloadFn(ctx, assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId))
  },
})

export const loadMapImage = campaignQuery({
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
