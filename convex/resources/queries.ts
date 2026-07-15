import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import { campaignQuery, dmQuery } from '../functions'
import {
  loadAuthorizedCollection,
  loadAuthorizedResource,
} from './functions/projectAuthorizedResources'
import {
  authorizedResourceSnapshotValidator,
  noteContentSnapshotValidator,
  resourceContentSnapshotValidator,
  resourceCollectionQueryValidator,
  workspaceSearchResultValidator,
} from './schema'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { loadNoteContent as loadNoteContentFn } from './functions/loadNoteContent'
import { loadResourceContent as loadResourceContentFn } from './functions/loadResourceContent'
import { resourceIdValidator } from './validators'
import { searchResources as searchResourcesFn } from './functions/searchResources'

type StoredAuthorizedResourceSnapshot = Infer<typeof authorizedResourceSnapshotValidator>

const authorizedResourceCollectionPageValidator = v.object({
  snapshot: authorizedResourceSnapshotValidator,
  cursor: v.nullable(v.string()),
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

export const loadNoteContent = campaignQuery({
  args: { resourceId: resourceIdValidator },
  returns: noteContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadNoteContentFn(ctx, resourceId)
  },
})

export const loadContent = campaignQuery({
  args: {
    resourceId: resourceIdValidator,
    kind: v.union(v.literal('file'), v.literal('map'), v.literal('canvas')),
  },
  returns: resourceContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadResourceContentFn(ctx, resourceId, args.kind)
  },
})

export const loadBookmarks = dmQuery({
  args: {},
  returns: v.array(resourceIdValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('resourceBookmarks')
      .withIndex('by_member', (index) =>
        index
          .eq('campaignUuid', ctx.resourceScope.campaignId)
          .eq('memberUuid', ctx.resourceScope.actorId),
      )
      .collect()
    return rows.map((row) => row.resourceUuid)
  },
})

export const searchResources = dmQuery({
  args: { query: v.string() },
  returns: v.array(workspaceSearchResultValidator),
  handler: async (ctx, args) =>
    (await searchResourcesFn(ctx, args.query)).map((result) => ({
      resourceId: result.resourceId,
      match: result.match.type === 'title' ? { type: 'title' as const } : { ...result.match },
    })),
})
