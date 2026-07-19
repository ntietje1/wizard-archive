import type { SourcePathAlias } from '@wizard-archive/editor/resources/catalog-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ImportJobId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { PlainTransferEntryIdentity } from '@wizard-archive/editor/resources/transfer-job-contract'
import { normalizeSourcePath } from '@wizard-archive/editor/resources/source-path-alias'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'

export type PlainTransferStartResult = Readonly<{
  status: 'ready' | 'cancelled' | 'completed' | 'completed_with_issues' | 'rejected'
}>

export type PlainTransferIdentity = Readonly<{
  jobId: string
  operationId: string
  destinationParentId: string | null
  sourceDigest: string
  entries: ReadonlyArray<PlainTransferEntryIdentity>
}>

type PlainTransferContext = Pick<CampaignMutationCtx, 'db' | 'resourceScope'>
type PlainTransferReadContext = Pick<CampaignQueryCtx, 'db' | 'resourceScope'>

export async function loadPlainTransfer(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  const job = await loadPlainTransferJob(ctx, jobId)
  if (!job || job.actorMemberUuid !== ctx.resourceScope.actorId) {
    return { status: 'unavailable' as const }
  }
  const entries = await loadPlainTransferEntries(ctx, jobId)
  if (entries.length === 0) throw new TypeError('Plain transfer has no entries')
  if (job.status === 'completed' && entries.some((entry) => entry.status !== 'completed')) {
    throw new TypeError('Completed plain transfer contains an incomplete entry')
  }
  if (
    job.status === 'completed_with_issues' &&
    (!entries.some((entry) => entry.status === 'completed') ||
      !entries.some((entry) => entry.status === 'rejected'))
  ) {
    throw new TypeError('Plain transfer issue status does not match its entries')
  }
  if (job.status === 'rejected' && entries.some((entry) => entry.status !== 'rejected')) {
    throw new TypeError('Rejected plain transfer contains a non-rejected entry')
  }
  return {
    status: job.status,
    jobId: job.importJobUuid,
    operationId: job.operationUuid,
    destinationParentId: job.destinationParentUuid,
    sourceDigest: job.sourceDigest,
    rejectionReason: job.rejectionReason,
    entries: entries.map((entry) => ({
      sourceRootId: entry.sourceRootId,
      rawPath: entry.rawPath,
      normalizedPath: entry.normalizedPath,
      plannedResourceId: entry.plannedResourceUuid,
      plannedOperationId: entry.plannedOperationUuid,
      resourceKind: entry.resourceKind,
      resourceId: entry.resourceUuid,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
    })),
  }
}

export async function beginPlainTransfer(
  ctx: PlainTransferContext,
  input: PlainTransferIdentity,
): Promise<PlainTransferStartResult> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  if (!validEntries(input.entries)) return { status: 'rejected' }
  const existing = await loadPlainTransferJob(ctx, jobId)
  if (existing) {
    const entries = await loadPlainTransferEntries(ctx, jobId)
    if (!matchesPlainTransfer(ctx, existing, entries, input)) {
      return { status: 'rejected' }
    }
    return { status: existing.status === 'pending' ? 'ready' : existing.status }
  }
  const createdAt = Date.now()
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
    sourceDigest: input.sourceDigest,
    status: 'pending',
    rejectionReason: null,
    createdAt,
    updatedAt: createdAt,
  })
  for (const entry of input.entries) {
    await ctx.db.insert('resourceTransferEntries', {
      campaignUuid: ctx.resourceScope.campaignId,
      importJobUuid: jobId,
      sourceRootId: entry.sourceRootId,
      rawPath: entry.rawPath,
      normalizedPath: entry.normalizedPath,
      plannedResourceUuid: entry.plannedResourceId,
      plannedOperationUuid: entry.plannedOperationId,
      resourceKind: entry.resourceKind,
      sourceDigest: input.sourceDigest,
      resourceUuid: null,
      status: 'pending',
      rejectionReason: null,
    })
  }
  return { status: 'ready' }
}

export async function cancelPlainTransfer(
  ctx: PlainTransferContext,
  input: PlainTransferIdentity,
): Promise<PlainTransferStartResult> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  let job = await loadPlainTransferJob(ctx, jobId)
  if (!job) {
    const started = await beginPlainTransfer(ctx, input)
    if (started.status !== 'ready') return started
    job = await loadPlainTransferJob(ctx, jobId)
    if (!job) throw new TypeError('Plain transfer cancellation did not create its job')
  }
  if (!matchesPlainTransferJob(ctx, job, input)) return { status: 'rejected' }
  if (job.status !== 'pending') return { status: job.status }
  const entries = await loadPlainTransferEntries(ctx, jobId)
  const updatedAt = Date.now()
  await ctx.db.patch('resourceTransferJobs', job._id, {
    status: 'cancelled',
    updatedAt,
  })
  for (const entry of entries) {
    if (entry.status === 'pending') {
      await ctx.db.patch('resourceTransferEntries', entry._id, {
        status: 'cancelled',
      })
    }
  }
  return { status: 'cancelled' }
}

export async function validatePlainTransferEntryCommit(
  ctx: PlainTransferContext,
  input: Readonly<{
    jobId: string
    operationId: OperationId
    sourceDigest: string
    resourceId: ResourceId
    kind: ResourceKind
    alias: SourcePathAlias
  }>,
): Promise<Readonly<{
  job: Doc<'resourceTransferJobs'>
  entry: Doc<'resourceTransferEntries'>
}> | null> {
  const jobId = assertDomainId(DOMAIN_ID_KIND.importJob, input.jobId)
  const job = await loadPlainTransferJob(ctx, jobId)
  if (
    !job ||
    job.actorMemberUuid !== ctx.resourceScope.actorId ||
    job.sourceDigest !== input.sourceDigest ||
    job.status !== 'pending'
  ) {
    return null
  }
  const entry = await loadPlainTransferEntry(
    ctx,
    jobId,
    input.alias.sourceRootId,
    input.alias.normalizedPath,
  )
  if (
    !entry ||
    entry.rawPath !== input.alias.rawPath ||
    entry.plannedResourceUuid !== input.resourceId ||
    entry.plannedOperationUuid !== input.operationId ||
    entry.resourceKind !== input.kind ||
    entry.sourceDigest !== input.sourceDigest ||
    entry.status !== 'pending'
  ) {
    return null
  }
  return { job, entry }
}

export async function settlePlainTransferEntry(
  ctx: PlainTransferContext,
  entry: Doc<'resourceTransferEntries'>,
  outcome:
    | Readonly<{ status: 'completed'; resourceId: ResourceId }>
    | Readonly<{ status: 'rejected'; reason: string }>,
): Promise<void> {
  if (entry.status !== 'pending') return
  const completed = outcome.status === 'completed'
  await ctx.db.patch('resourceTransferEntries', entry._id, {
    resourceUuid: completed ? outcome.resourceId : null,
    status: outcome.status,
    rejectionReason: completed ? null : outcome.reason,
  })
}

export async function finishPlainTransfer(
  ctx: PlainTransferContext,
  jobId: ImportJobId,
): Promise<'completed' | 'completed_with_issues' | 'rejected'> {
  const job = await loadPlainTransferJob(ctx, jobId)
  if (!job || job.actorMemberUuid !== ctx.resourceScope.actorId || job.status !== 'pending') {
    return job?.status === 'completed' || job?.status === 'completed_with_issues'
      ? job.status
      : 'rejected'
  }
  const entries = await loadPlainTransferEntries(ctx, jobId)
  if (entries.length === 0 || entries.some((entry) => entry.status === 'pending')) {
    return 'rejected'
  }
  const status = entries.some((entry) => entry.status === 'rejected')
    ? entries.some((entry) => entry.status === 'completed')
      ? 'completed_with_issues'
      : 'rejected'
    : 'completed'
  await ctx.db.patch('resourceTransferJobs', job._id, {
    status,
    rejectionReason: status === 'rejected' ? 'all_entries_rejected' : null,
    updatedAt: Date.now(),
  })
  return status
}

function validEntries(entries: ReadonlyArray<PlainTransferEntryIdentity>): boolean {
  const identities = new Set<string>()
  try {
    for (const entry of entries) {
      if (normalizeSourcePath(entry.rawPath) !== entry.normalizedPath) return false
      const key = entryKey(entry)
      if (identities.has(key)) return false
      identities.add(key)
    }
  } catch {
    return false
  }
  return entries.length > 0
}

function matchesPlainTransfer(
  ctx: PlainTransferContext,
  job: Doc<'resourceTransferJobs'>,
  entries: ReadonlyArray<Doc<'resourceTransferEntries'>>,
  input: PlainTransferIdentity,
): boolean {
  if (!matchesPlainTransferJob(ctx, job, input) || entries.length !== input.entries.length) {
    return false
  }
  const expected = new Map(input.entries.map((entry) => [entryKey(entry), entry]))
  return entries.every((entry) => {
    const identity = expected.get(entryKey(entry))
    return (
      identity?.plannedResourceId === entry.plannedResourceUuid &&
      identity.plannedOperationId === entry.plannedOperationUuid &&
      identity.resourceKind === entry.resourceKind &&
      entry.sourceDigest === input.sourceDigest
    )
  })
}

function matchesPlainTransferJob(
  ctx: PlainTransferContext,
  job: Doc<'resourceTransferJobs'>,
  input: Omit<PlainTransferIdentity, 'entries'>,
): boolean {
  return (
    job.actorMemberUuid === ctx.resourceScope.actorId &&
    job.operationUuid === input.operationId &&
    job.destinationParentUuid === input.destinationParentId &&
    job.sourceDigest === input.sourceDigest &&
    job.mode === 'plain_resources'
  )
}

function entryKey(entry: Pick<PlainTransferEntryIdentity, 'sourceRootId' | 'normalizedPath'>) {
  return `${entry.sourceRootId}\0${entry.normalizedPath}`
}

async function loadPlainTransferJob(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  return await ctx.db
    .query('resourceTransferJobs')
    .withIndex('by_campaign_and_importJobUuid', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .unique()
}

async function loadPlainTransferEntries(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  return await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .collect()
}

async function loadPlainTransferEntry(
  ctx: PlainTransferReadContext,
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
