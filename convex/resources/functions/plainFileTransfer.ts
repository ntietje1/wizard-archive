import type { SourcePathAlias } from '@wizard-archive/editor/resources/catalog-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ImportJobId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { normalizeSourcePath } from '@wizard-archive/editor/resources/source-path-alias'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'

export type PlainFileTransferStartResult = Readonly<{
  status: 'ready' | 'cancelled' | 'completed' | 'rejected'
}>

type PlainFileTransferIdentity = Readonly<{
  jobId: string
  operationId: string
  destinationParentId: string | null
  sourceRootId: string
  rawPath: string
  normalizedPath: string
}>

type PlainFileTransferContext = Pick<CampaignMutationCtx, 'db' | 'resourceScope'>
type PlainFileTransferReadContext = Pick<CampaignQueryCtx, 'db' | 'resourceScope'>

export async function loadPlainFileTransfer(ctx: PlainFileTransferReadContext, jobId: ImportJobId) {
  const job = await loadPlainFileTransferJob(ctx, jobId)
  if (!job || job.actorMemberUuid !== ctx.resourceScope.actorId) {
    return { status: 'unavailable' as const }
  }
  const entries = await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .take(2)
  if (entries.length !== 1) throw new TypeError('Plain file transfer entry is corrupt')
  const entry = entries[0]!
  if (
    entry.status !== job.status ||
    entry.sourceDigest !== job.sourceDigest ||
    entry.rejectionReason !== job.rejectionReason ||
    (entry.status === 'completed') !== (entry.resourceUuid !== null)
  ) {
    throw new TypeError('Plain file transfer outcome is corrupt')
  }
  return {
    status: job.status,
    jobId: job.importJobUuid,
    operationId: job.operationUuid,
    destinationParentId: job.destinationParentUuid,
    sourceDigest: job.sourceDigest,
    rejectionReason: job.rejectionReason,
    entry: {
      sourceRootId: entry.sourceRootId,
      rawPath: entry.rawPath,
      normalizedPath: entry.normalizedPath,
      sourceDigest: entry.sourceDigest,
      resourceId: entry.resourceUuid,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
    },
  }
}

export async function beginPlainFileTransfer(
  ctx: PlainFileTransferContext,
  input: PlainFileTransferIdentity,
): Promise<PlainFileTransferStartResult> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  if (normalizeSourcePath(input.rawPath) !== input.normalizedPath) {
    return { status: 'rejected' }
  }
  const existing = await loadPlainFileTransferJob(ctx, jobId)
  if (existing) {
    const entry = await loadPlainFileTransferEntry(
      ctx,
      jobId,
      input.sourceRootId,
      input.normalizedPath,
    )
    if (!matchesPlainFileTransfer(ctx, existing, entry, input)) {
      return { status: 'rejected' }
    }
    return { status: existing.status === 'pending' ? 'ready' : existing.status }
  }

  await insertPlainFileTransfer(ctx, input, 'pending')
  return { status: 'ready' }
}

export async function cancelPlainFileTransfer(
  ctx: PlainFileTransferContext,
  source: Omit<PlainFileTransferIdentity, 'normalizedPath'>,
): Promise<PlainFileTransferStartResult> {
  let normalizedPath: string
  try {
    normalizedPath = normalizeSourcePath(source.rawPath)
  } catch {
    return { status: 'rejected' }
  }
  const input = { ...source, normalizedPath }
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  const job = await loadPlainFileTransferJob(ctx, jobId)
  if (!job) {
    await insertPlainFileTransfer(ctx, input, 'cancelled')
    return { status: 'cancelled' }
  }
  const entry = await loadPlainFileTransferEntry(
    ctx,
    jobId,
    input.sourceRootId,
    input.normalizedPath,
  )
  if (!matchesPlainFileTransfer(ctx, job, entry, input)) {
    return { status: 'rejected' }
  }
  if (job.status !== 'pending') return { status: job.status }
  if (entry.status !== 'pending') return { status: 'rejected' }

  const updatedAt = Date.now()
  await ctx.db.patch('resourceTransferJobs', job._id, {
    status: 'cancelled',
    updatedAt,
  })
  await ctx.db.patch('resourceTransferEntries', entry._id, {
    status: 'cancelled',
  })
  return { status: 'cancelled' }
}

export async function validatePlainFileTransferCommit(
  ctx: PlainFileTransferContext,
  input: Readonly<{
    jobId: string
    operationId: string
    destinationParentId: ResourceId | null
    sourceDigest: string
    alias: SourcePathAlias
  }>,
): Promise<Doc<'resourceTransferJobs'> | null> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  const job = await loadPlainFileTransferJob(ctx, jobId)
  if (
    !job ||
    job.actorMemberUuid !== ctx.resourceScope.actorId ||
    job.operationUuid !== input.operationId ||
    job.destinationParentUuid !== input.destinationParentId ||
    (job.sourceDigest !== null && job.sourceDigest !== input.sourceDigest) ||
    job.status === 'cancelled' ||
    job.status === 'rejected'
  ) {
    return null
  }
  const entry = await loadPlainFileTransferEntry(
    ctx,
    jobId,
    input.alias.sourceRootId,
    input.alias.normalizedPath,
  )
  return entry?.rawPath === input.alias.rawPath ? job : null
}

export async function settlePlainFileTransfer(
  ctx: PlainFileTransferContext,
  job: Doc<'resourceTransferJobs'>,
  input: Readonly<{
    sourceDigest: string
    alias: SourcePathAlias
    outcome:
      | Readonly<{ status: 'completed'; resourceId: ResourceId }>
      | Readonly<{ status: 'rejected'; reason: string }>
  }>,
): Promise<void> {
  const entry = await loadPlainFileTransferEntry(
    ctx,
    assertDomainId(DOMAIN_ID_KIND.importJob, job.importJobUuid),
    input.alias.sourceRootId,
    input.alias.normalizedPath,
  )
  if (!entry) throw new TypeError('Plain transfer entry is unavailable')
  if (job.status === 'completed' && input.outcome.status === 'rejected') return

  const completed = input.outcome.status === 'completed'
  const rejectionReason = completed ? null : input.outcome.reason
  await ctx.db.patch('resourceTransferJobs', job._id, {
    sourceDigest: input.sourceDigest,
    status: input.outcome.status,
    rejectionReason,
    updatedAt: Date.now(),
  })
  await ctx.db.patch('resourceTransferEntries', entry._id, {
    sourceDigest: input.sourceDigest,
    resourceUuid: completed ? input.outcome.resourceId : null,
    status: input.outcome.status,
    rejectionReason,
  })
}

function matchesPlainFileTransfer(
  ctx: PlainFileTransferContext,
  job: Doc<'resourceTransferJobs'>,
  entry: Doc<'resourceTransferEntries'> | null,
  input: PlainFileTransferIdentity,
): entry is Doc<'resourceTransferEntries'> {
  return (
    job.actorMemberUuid === ctx.resourceScope.actorId &&
    job.operationUuid === input.operationId &&
    job.destinationParentUuid === input.destinationParentId &&
    job.mode === 'plain_resources' &&
    entry?.rawPath === input.rawPath
  )
}

async function insertPlainFileTransfer(
  ctx: PlainFileTransferContext,
  input: PlainFileTransferIdentity,
  status: 'cancelled' | 'pending',
): Promise<void> {
  const createdAt = Date.now()
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  await ctx.db.insert('resourceTransferJobs', {
    campaignUuid: ctx.resourceScope.campaignId,
    importJobUuid: jobId,
    actorMemberUuid: ctx.resourceScope.actorId,
    operationUuid: assertDomainId(DOMAIN_ID_KIND.operation, input.operationId),
    destinationParentUuid:
      input.destinationParentId === null
        ? null
        : assertDomainId(DOMAIN_ID_KIND.resource, input.destinationParentId),
    mode: 'plain_resources',
    sourceDigest: null,
    status,
    rejectionReason: null,
    createdAt,
    updatedAt: createdAt,
  })
  await ctx.db.insert('resourceTransferEntries', {
    campaignUuid: ctx.resourceScope.campaignId,
    importJobUuid: jobId,
    sourceRootId: input.sourceRootId,
    rawPath: input.rawPath,
    normalizedPath: input.normalizedPath,
    sourceDigest: null,
    resourceUuid: null,
    status,
    rejectionReason: null,
  })
}

async function loadPlainFileTransferJob(ctx: PlainFileTransferReadContext, jobId: ImportJobId) {
  return await ctx.db
    .query('resourceTransferJobs')
    .withIndex('by_campaign_and_importJobUuid', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .unique()
}

async function loadPlainFileTransferEntry(
  ctx: PlainFileTransferReadContext,
  jobId: ImportJobId,
  sourceRootId: string,
  normalizedPath: string,
) {
  return await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job_and_source_and_path', (query) =>
      query
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .eq('importJobUuid', jobId)
        .eq('sourceRootId', sourceRootId)
        .eq('normalizedPath', normalizedPath),
    )
    .unique()
}
