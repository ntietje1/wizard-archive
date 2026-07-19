import { literals } from 'convex-helpers/validators'
import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import { internalQuery } from '../_generated/server'
import type { QueryCtx } from '../_generated/server'
import { assetIdValidator, resourceIdValidator } from './validators'
import { mapAssetIds } from './functions/assetContent'

const MAX_DIAGNOSTIC_PAGE_SIZE = 100

const diagnosticRequestValidator = v.union(
  v.object({ type: v.literal('resource_without_content') }),
  v.object({
    type: v.literal('content_without_resource'),
    kind: literals('note', 'file', 'map', 'canvas'),
  }),
  v.object({
    type: v.literal('dangling_domain_asset'),
    source: literals('owner', 'file', 'map'),
  }),
  v.object({ type: v.literal('failed_byte_copy'), staleBefore: v.number() }),
  v.object({ type: v.literal('failed_retirement'), staleBefore: v.number() }),
)

const integrityIssueValidator = v.object({
  type: literals(
    'resource_without_content',
    'content_without_resource',
    'dangling_domain_asset',
    'failed_byte_copy',
    'failed_retirement',
  ),
  recordId: v.string(),
  resourceUuid: v.nullable(resourceIdValidator),
  assetUuid: v.nullable(assetIdValidator),
  repair: literals('report_only', 'retry_byte_copy', 'retry_retirement'),
})

type IntegrityIssue = {
  type:
    | 'resource_without_content'
    | 'content_without_resource'
    | 'dangling_domain_asset'
    | 'failed_byte_copy'
    | 'failed_retirement'
  recordId: string
  resourceUuid: string | null
  assetUuid: string | null
  repair: 'report_only' | 'retry_byte_copy' | 'retry_retirement'
}

function result(page: { continueCursor: string; isDone: boolean }, issues: Array<IntegrityIssue>) {
  return { issues, cursor: page.continueCursor, done: page.isDone }
}

function collectIssues<T>(
  rows: ReadonlyArray<T>,
  issueFor: (row: T) => IntegrityIssue | null,
): Array<IntegrityIssue> {
  const issues: Array<IntegrityIssue> = []
  for (const row of rows) {
    const issue = issueFor(row)
    if (issue) issues.push(issue)
  }
  return issues
}

async function collectAsyncIssues<T>(
  rows: ReadonlyArray<T>,
  issueFor: (row: T) => Promise<IntegrityIssue | null>,
): Promise<Array<IntegrityIssue>> {
  const issues = await Promise.all(rows.map(issueFor))
  return issues.filter((issue): issue is IntegrityIssue => issue !== null)
}

async function resourceHasContent(ctx: QueryCtx, resource: Doc<'resources'>): Promise<boolean> {
  if (resource.kind === 'folder') return true
  let content:
    | Doc<'resourceNoteContents'>
    | Doc<'resourceFileContents'>
    | Doc<'resourceMapContents'>
    | Doc<'resourceCanvasContents'>
    | null
  switch (resource.kind) {
    case 'note':
      content = await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .unique()
      break
    case 'file':
      content = await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .unique()
      break
    case 'map':
      content = await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .unique()
      break
    case 'canvas':
      content = await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .unique()
  }
  return content?.campaignUuid === resource.campaignUuid
}

async function contentHasResource(
  ctx: QueryCtx,
  content: { campaignUuid: string; resourceUuid: string },
  kind: 'note' | 'file' | 'map' | 'canvas',
): Promise<boolean> {
  const resource = await ctx.db
    .query('resources')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', content.resourceUuid))
    .unique()
  return resource?.campaignUuid === content.campaignUuid && resource.kind === kind
}

async function contentIssues(
  ctx: QueryCtx,
  rows: ReadonlyArray<
    | Doc<'resourceNoteContents'>
    | Doc<'resourceFileContents'>
    | Doc<'resourceMapContents'>
    | Doc<'resourceCanvasContents'>
  >,
  kind: 'note' | 'file' | 'map' | 'canvas',
): Promise<Array<IntegrityIssue>> {
  return await collectAsyncIssues(rows, async (content) =>
    (await contentHasResource(ctx, content, kind))
      ? null
      : {
          type: 'content_without_resource',
          recordId: content._id,
          resourceUuid: content.resourceUuid,
          assetUuid: null,
          repair: 'report_only',
        },
  )
}

async function assetHasOwner(
  ctx: QueryCtx,
  campaignUuid: string,
  resourceUuid: string,
  assetUuid: string,
): Promise<boolean> {
  const [owners, storage] = await Promise.all([
    ctx.db
      .query('resourceAssetOwners')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetUuid))
      .take(2),
    ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetUuid))
      .take(2),
  ])
  return (
    owners.length === 1 &&
    owners[0]!.campaignUuid === campaignUuid &&
    owners[0]!.resourceUuid === resourceUuid &&
    storage.length === 1 &&
    storage[0]!.status === 'committed' &&
    storage[0]!.storageId !== null
  )
}

async function ownerIsCurrent(ctx: QueryCtx, owner: Doc<'resourceAssetOwners'>): Promise<boolean> {
  const [file, map, storage] = await Promise.all([
    ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', owner.resourceUuid))
      .unique(),
    ctx.db
      .query('resourceMapContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', owner.resourceUuid))
      .unique(),
    ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', owner.assetUuid))
      .unique(),
  ])
  if (file?.assetUuid === owner.assetUuid) {
    return file.state !== 'ready' || storage?.status === 'committed'
  }
  if (
    map?.image?.assetUuid === owner.assetUuid ||
    map?.layers.some((layer) => layer.image?.assetUuid === owner.assetUuid)
  ) {
    return map.state !== 'ready' || storage?.status === 'committed'
  }
  return false
}

function isFailedOrStale(
  work: { status: string; lastAttemptAt: number | null },
  staleBefore: number,
): boolean {
  return (
    work.status === 'failed' ||
    (work.status === 'processing' &&
      work.lastAttemptAt !== null &&
      work.lastAttemptAt <= staleBefore)
  )
}

type DiagnosticRequest = Infer<typeof diagnosticRequestValidator>
type DiagnosticPagination = { cursor: string | null; numItems: number }

async function diagnoseResourceWithoutContent(ctx: QueryCtx, pagination: DiagnosticPagination) {
  const page = await ctx.db.query('resources').order('asc').paginate(pagination)
  const issues = await collectAsyncIssues(page.page, async (resource) =>
    (await resourceHasContent(ctx, resource))
      ? null
      : {
          type: 'resource_without_content',
          recordId: resource._id,
          resourceUuid: resource.resourceUuid,
          assetUuid: null,
          repair: 'report_only',
        },
  )
  return result(page, issues)
}

async function diagnoseContentWithoutResource(
  ctx: QueryCtx,
  pagination: DiagnosticPagination,
  kind: Extract<DiagnosticRequest, { type: 'content_without_resource' }>['kind'],
) {
  switch (kind) {
    case 'note': {
      const page = await ctx.db.query('resourceNoteContents').order('asc').paginate(pagination)
      return result(page, await contentIssues(ctx, page.page, kind))
    }
    case 'file': {
      const page = await ctx.db.query('resourceFileContents').order('asc').paginate(pagination)
      return result(page, await contentIssues(ctx, page.page, kind))
    }
    case 'map': {
      const page = await ctx.db.query('resourceMapContents').order('asc').paginate(pagination)
      return result(page, await contentIssues(ctx, page.page, kind))
    }
    case 'canvas': {
      const page = await ctx.db.query('resourceCanvasContents').order('asc').paginate(pagination)
      return result(page, await contentIssues(ctx, page.page, kind))
    }
  }
}

async function diagnoseDanglingOwner(ctx: QueryCtx, pagination: DiagnosticPagination) {
  const page = await ctx.db.query('resourceAssetOwners').order('asc').paginate(pagination)
  const issues = await collectAsyncIssues(page.page, async (owner) =>
    (await ownerIsCurrent(ctx, owner))
      ? null
      : {
          type: 'dangling_domain_asset',
          recordId: owner._id,
          resourceUuid: owner.resourceUuid,
          assetUuid: owner.assetUuid,
          repair: 'report_only',
        },
  )
  return result(page, issues)
}

async function diagnoseDanglingFileAsset(ctx: QueryCtx, pagination: DiagnosticPagination) {
  const page = await ctx.db.query('resourceFileContents').order('asc').paginate(pagination)
  const issues = await collectAsyncIssues(page.page, async (content) =>
    content.assetUuid === null ||
    (await assetHasOwner(ctx, content.campaignUuid, content.resourceUuid, content.assetUuid))
      ? null
      : {
          type: 'dangling_domain_asset',
          recordId: content._id,
          resourceUuid: content.resourceUuid,
          assetUuid: content.assetUuid,
          repair: 'report_only',
        },
  )
  return result(page, issues)
}

async function diagnoseDanglingMapAsset(ctx: QueryCtx, pagination: DiagnosticPagination) {
  const page = await ctx.db.query('resourceMapContents').order('asc').paginate(pagination)
  const issues: Array<IntegrityIssue> = []
  for (const content of page.page) {
    const assets = mapAssetIds(content)
    const ownership = await Promise.all(
      assets.map(async (assetUuid) => ({
        assetUuid,
        owned: await assetHasOwner(ctx, content.campaignUuid, content.resourceUuid, assetUuid),
      })),
    )
    const assetUuid = ownership.find(({ owned }) => !owned)?.assetUuid
    if (assetUuid) {
      issues.push({
        type: 'dangling_domain_asset',
        recordId: content._id,
        resourceUuid: content.resourceUuid,
        assetUuid,
        repair: 'report_only',
      })
    }
  }
  return result(page, issues)
}

async function diagnoseDanglingAsset(
  ctx: QueryCtx,
  pagination: DiagnosticPagination,
  source: Extract<DiagnosticRequest, { type: 'dangling_domain_asset' }>['source'],
) {
  switch (source) {
    case 'owner':
      return await diagnoseDanglingOwner(ctx, pagination)
    case 'file':
      return await diagnoseDanglingFileAsset(ctx, pagination)
    case 'map':
      return await diagnoseDanglingMapAsset(ctx, pagination)
  }
}

async function diagnoseFailedCopy(
  ctx: QueryCtx,
  pagination: DiagnosticPagination,
  staleBefore: number,
) {
  const page = await ctx.db.query('resourceAssetCopyIntents').order('asc').paginate(pagination)
  return result(
    page,
    collectIssues(page.page, (intent) =>
      isFailedOrStale(intent, staleBefore)
        ? {
            type: 'failed_byte_copy',
            recordId: intent._id,
            resourceUuid: intent.resourceUuid,
            assetUuid: intent.destinationAssetUuid,
            repair: 'retry_byte_copy',
          }
        : null,
    ),
  )
}

async function diagnoseFailedRetirement(
  ctx: QueryCtx,
  pagination: DiagnosticPagination,
  staleBefore: number,
) {
  const page = await ctx.db
    .query('resourceAssetRetirementCandidates')
    .order('asc')
    .paginate(pagination)
  return result(
    page,
    collectIssues(page.page, (candidate) =>
      isFailedOrStale(candidate, staleBefore)
        ? {
            type: 'failed_retirement',
            recordId: candidate._id,
            resourceUuid: null,
            assetUuid: candidate.assetUuid,
            repair: 'retry_retirement',
          }
        : null,
    ),
  )
}

async function runDiagnostic(
  ctx: QueryCtx,
  pagination: DiagnosticPagination,
  diagnostic: DiagnosticRequest,
) {
  switch (diagnostic.type) {
    case 'resource_without_content':
      return await diagnoseResourceWithoutContent(ctx, pagination)
    case 'content_without_resource':
      return await diagnoseContentWithoutResource(ctx, pagination, diagnostic.kind)
    case 'dangling_domain_asset':
      return await diagnoseDanglingAsset(ctx, pagination, diagnostic.source)
    case 'failed_byte_copy':
      return await diagnoseFailedCopy(ctx, pagination, diagnostic.staleBefore)
    case 'failed_retirement':
      return await diagnoseFailedRetirement(ctx, pagination, diagnostic.staleBefore)
  }
}

export const diagnose = internalQuery({
  args: {
    diagnostic: diagnosticRequestValidator,
    cursor: v.nullable(v.string()),
    limit: v.number(),
  },
  returns: v.object({
    issues: v.array(integrityIssueValidator),
    cursor: v.string(),
    done: v.boolean(),
  }),
  handler: async (ctx, { diagnostic, cursor, limit }) => {
    return await runDiagnostic(
      ctx,
      {
        cursor,
        numItems: Math.max(1, Math.min(MAX_DIAGNOSTIC_PAGE_SIZE, Math.floor(limit))),
      },
      diagnostic,
    )
  },
})
