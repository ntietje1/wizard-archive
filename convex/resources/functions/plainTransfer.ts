import type { PlainTransferPlan } from '@wizard-archive/editor/resources/plain-transfer-inventory'
import {
  PLAIN_TRANSFER_LIMITS,
  digestPlainTransferPlan,
  planPlainTransferManifest,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ImportJobId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import { normalizeSourcePath } from '@wizard-archive/editor/resources/source-path-alias'
import type {
  PlainTransferManifest,
  PlainTransferReceipt,
} from '@wizard-archive/editor/resources/transfer-job-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'

type PlainTransferContext = Pick<
  CampaignMutationCtx,
  'db' | 'membership' | 'resourceScope' | 'storage'
>
type PlainTransferReadContext = Pick<CampaignQueryCtx, 'db' | 'resourceScope'>

export type PlainTransferUploadTarget = Readonly<{
  sourceId: string
  sourcePath: string
  sessionId: Id<'fileStorage'>
  uploadUrl: string
}>

export type PlainTransferReservationResult =
  | Readonly<{
      status: 'reserved'
      receipt: PlainTransferReceipt
      uploadTargets: Array<PlainTransferUploadTarget>
    }>
  | Readonly<{ status: 'rejected'; reason: string }>

export async function reservePlainTransfer(
  ctx: PlainTransferContext,
  manifest: PlainTransferManifest,
): Promise<PlainTransferReservationResult> {
  if (manifest.destinationCampaignId !== ctx.resourceScope.campaignId) {
    return { status: 'rejected', reason: 'invalid_campaign' }
  }
  const planned = await planPlainTransferManifest(manifest)
  if (planned.status === 'rejected') return planned
  const [fingerprint, existing] = await Promise.all([
    digestPlainTransferPlan(planned.plan),
    loadPlainTransferJob(ctx, manifest.jobId),
  ])
  if (existing) {
    if (
      existing.actorMemberUuid !== ctx.resourceScope.actorId ||
      existing.fingerprint !== fingerprint
    ) {
      return { status: 'rejected', reason: 'job_conflict' }
    }
    const entries = await loadPlainTransferEntries(ctx, manifest.jobId)
    return {
      status: 'reserved',
      receipt: plainTransferReceipt(existing, entries),
      uploadTargets: await createRetryUploadTargets(ctx, entries),
    }
  }

  const createdAt = Date.now()
  await ctx.db.insert('resourceTransferJobs', {
    campaignUuid: ctx.resourceScope.campaignId,
    importJobUuid: manifest.jobId,
    actorMemberUuid: ctx.resourceScope.actorId,
    manifestVersion: manifest.version,
    fingerprint,
    destinationParentUuid: manifest.destinationParentId,
    textFileHandling: manifest.textFileHandling,
    sources: [...manifest.sources],
    status: 'reserved',
    createdAt,
    updatedAt: createdAt,
  })
  const uploadTargets: Array<PlainTransferUploadTarget> = []
  const explicitEntries = new Set(
    manifest.entries.map((entry) => `${entry.sourceId}\0${normalizeSourcePath(entry.path)}`),
  )
  for (const resource of planned.plan.resources) {
    const uploadSessionId =
      resource.entryType === 'file'
        ? await ctx.db.insert('fileStorage', {
            assetUuid: null,
            status: 'pending',
            storageId: null,
            userId: ctx.membership.userId,
            originalFileName: null,
          })
        : null
    await ctx.db.insert('resourceTransferEntries', {
      campaignUuid: ctx.resourceScope.campaignId,
      importJobUuid: manifest.jobId,
      sourceRootId: resource.alias.sourceRootId,
      sourceEntryPath: resource.sourceEntryPath,
      rawPath: resource.alias.rawPath,
      normalizedPath: resource.alias.normalizedPath,
      plannedResourceUuid: resource.id,
      plannedOperationUuid: resource.operationId,
      parentResourceUuid: resource.parentId,
      title: resource.title,
      entryType: resource.entryType,
      isExplicit: explicitEntries.has(
        `${resource.alias.sourceRootId}\0${resource.sourceEntryPath}`,
      ),
      declaredByteSize: resource.declaredByteSize,
      uploadSessionUuid: uploadSessionId,
      resourceKind: resource.entryType === 'directory' ? 'folder' : null,
      resourceUuid: null,
      status: 'pending',
      rejectionReason: null,
    })
    if (uploadSessionId) {
      uploadTargets.push({
        sourceId: resource.alias.sourceRootId,
        sourcePath: resource.sourceEntryPath,
        sessionId: uploadSessionId,
        uploadUrl: await ctx.storage.generateUploadUrl(),
      })
    }
  }
  return {
    status: 'reserved',
    receipt: {
      jobId: manifest.jobId,
      status: 'reserved',
      entries: planned.plan.resources.map((resource) => ({
        status: 'pending',
        sourceId: resource.alias.sourceRootId,
        sourcePath: resource.alias.rawPath,
      })),
    },
    uploadTargets,
  }
}

export async function loadPlainTransfer(
  ctx: PlainTransferReadContext,
  jobId: ImportJobId,
): Promise<PlainTransferReceipt | Readonly<{ status: 'unavailable' }>> {
  const transfer = await loadOwnedPlainTransfer(ctx, jobId)
  return transfer ? plainTransferReceipt(transfer.job, transfer.entries) : { status: 'unavailable' }
}

export async function startPlainTransfer(ctx: PlainTransferContext, jobId: ImportJobId) {
  const transfer = await loadOwnedPlainTransfer(ctx, jobId)
  if (!transfer) return unavailable()
  const { entries, job } = transfer
  if (job.status === 'reserved') {
    await ctx.db.patch('resourceTransferJobs', job._id, {
      status: 'running',
      updatedAt: Date.now(),
    })
    return storedPlainTransferSnapshot({ ...job, status: 'running' }, entries)
  }
  return storedPlainTransferSnapshot(job, entries)
}

export async function cancelPlainTransfer(
  ctx: PlainTransferContext,
  jobId: ImportJobId,
): Promise<PlainTransferReceipt | Readonly<{ status: 'unavailable' }>> {
  const transfer = await loadOwnedPlainTransfer(ctx, jobId)
  if (!transfer) return { status: 'unavailable' }
  const { entries, job } = transfer
  if (job.status === 'settled') return plainTransferReceipt(job, entries)

  return await settleRemainingPlainTransfer(ctx, job, entries, { status: 'cancelled' })
}

export async function validatePlainTransferEntryCommit(
  ctx: PlainTransferContext,
  input: Readonly<{
    jobId: ImportJobId
    sourceId: string
    sourcePath: string
    kind: Extract<ResourceKind, 'file' | 'folder' | 'note'>
  }>,
): Promise<Readonly<{
  job: Doc<'resourceTransferJobs'>
  entry: Doc<'resourceTransferEntries'>
}> | null> {
  const job = await loadPlainTransferJob(ctx, input.jobId)
  if (!job || job.actorMemberUuid !== ctx.resourceScope.actorId || job.status !== 'running') {
    return null
  }
  const entry = await loadPlainTransferEntry(ctx, input.jobId, input.sourceId, input.sourcePath)
  if (
    !entry ||
    entry.status !== 'pending' ||
    (entry.entryType === 'directory' ? input.kind !== 'folder' : input.kind === 'folder') ||
    (entry.resourceKind !== null && entry.resourceKind !== input.kind)
  ) {
    return null
  }
  return { job, entry }
}

export async function settlePlainTransferEntry(
  ctx: PlainTransferContext,
  entry: Doc<'resourceTransferEntries'>,
  outcome:
    | Readonly<{
        status: 'completed'
        resourceId: ResourceId
        kind: Extract<ResourceKind, 'file' | 'folder' | 'note'>
      }>
    | Readonly<{ status: 'rejected'; reason: string }>,
): Promise<void> {
  if (entry.status !== 'pending') return
  if (outcome.status === 'completed' && outcome.kind === 'note') {
    await discardReservedUpload(ctx, entry.uploadSessionUuid)
  }
  await ctx.db.patch('resourceTransferEntries', entry._id, {
    resourceKind: outcome.status === 'completed' ? outcome.kind : entry.resourceKind,
    resourceUuid: outcome.status === 'completed' ? outcome.resourceId : null,
    status: outcome.status,
    rejectionReason: outcome.status === 'rejected' ? outcome.reason : null,
    uploadSessionUuid:
      outcome.status === 'completed' && outcome.kind === 'note' ? null : entry.uploadSessionUuid,
  })
}

export async function finishPlainTransfer(
  ctx: PlainTransferContext,
  jobId: ImportJobId,
): Promise<PlainTransferReceipt | Readonly<{ status: 'unavailable' }>> {
  const transfer = await loadOwnedPlainTransfer(ctx, jobId)
  if (!transfer) return { status: 'unavailable' }
  const { entries, job } = transfer
  if (job.status !== 'settled' && entries.every((entry) => entry.status !== 'pending')) {
    await ctx.db.patch('resourceTransferJobs', job._id, {
      status: 'settled',
      updatedAt: Date.now(),
    })
    return plainTransferReceipt({ ...job, status: 'settled' }, entries)
  }
  return plainTransferReceipt(job, entries)
}

export async function rejectPlainTransfer(
  ctx: PlainTransferContext,
  jobId: ImportJobId,
  reason: string,
): Promise<PlainTransferReceipt | Readonly<{ status: 'unavailable' }>> {
  const transfer = await loadOwnedPlainTransfer(ctx, jobId)
  if (!transfer) return { status: 'unavailable' }
  return await settleRemainingPlainTransfer(ctx, transfer.job, transfer.entries, {
    status: 'rejected',
    reason,
  })
}

async function settleRemainingPlainTransfer(
  ctx: PlainTransferContext,
  job: Doc<'resourceTransferJobs'>,
  entries: ReadonlyArray<Doc<'resourceTransferEntries'>>,
  outcome: Readonly<{ status: 'cancelled' }> | Readonly<{ status: 'rejected'; reason: string }>,
): Promise<PlainTransferReceipt> {
  await Promise.all(
    entries.flatMap((entry) =>
      entry.status === 'pending'
        ? [
            (async () => {
              await discardReservedUpload(ctx, entry.uploadSessionUuid)
              await ctx.db.patch('resourceTransferEntries', entry._id, {
                status: outcome.status,
                rejectionReason: outcome.status === 'rejected' ? outcome.reason : null,
                uploadSessionUuid: null,
              })
            })(),
          ]
        : [],
    ),
  )
  if (job.status !== 'settled') {
    await ctx.db.patch('resourceTransferJobs', job._id, {
      status: 'settled',
      updatedAt: Date.now(),
    })
  }
  return plainTransferReceipt(
    { ...job, status: 'settled' },
    await loadPlainTransferEntries(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.importJob, job.importJobUuid),
    ),
  )
}

export function storedPlainTransferPlan(
  snapshot: ReturnType<typeof storedPlainTransferSnapshot>,
): PlainTransferPlan {
  const pending = snapshot.entries.filter((entry) => entry.status === 'pending')
  return {
    manifest: {
      version: 'plain-transfer-manifest-v1',
      jobId: assertDomainId(DOMAIN_ID_KIND.importJob, snapshot.jobId),
      destinationCampaignId: assertDomainId(
        DOMAIN_ID_KIND.campaign,
        snapshot.entries[0]!.alias.campaignId,
      ),
      destinationParentId:
        snapshot.destinationParentId === null
          ? null
          : assertDomainId(DOMAIN_ID_KIND.resource, snapshot.destinationParentId),
      textFileHandling: snapshot.textFileHandling,
      sources: snapshot.sources,
      entries: pending.flatMap((entry) =>
        entry.explicit
          ? [
              entry.entryType === 'directory'
                ? {
                    sourceId: entry.alias.sourceRootId,
                    path: entry.sourceEntryPath,
                    type: 'directory' as const,
                  }
                : {
                    sourceId: entry.alias.sourceRootId,
                    path: entry.sourceEntryPath,
                    type: 'file' as const,
                    byteSize: entry.declaredByteSize,
                  },
            ]
          : [],
      ),
    },
    resources: pending.map(
      ({ explicit: _explicit, status: _status, uploadSessionId: _upload, ...entry }) => ({
        ...entry,
        id: assertDomainId(DOMAIN_ID_KIND.resource, entry.id),
        operationId: assertDomainId(DOMAIN_ID_KIND.operation, entry.operationId),
        parentId:
          entry.parentId === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, entry.parentId),
        title: canonicalizeResourceTitle(entry.title),
        alias: {
          ...entry.alias,
          campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, entry.alias.campaignId),
          resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.alias.resourceId),
          importJobId: assertDomainId(DOMAIN_ID_KIND.importJob, entry.alias.importJobId),
        },
      }),
    ),
  }
}

function storedPlanEntry(entry: Doc<'resourceTransferEntries'>) {
  return {
    id: entry.plannedResourceUuid,
    operationId: entry.plannedOperationUuid,
    parentId: entry.parentResourceUuid,
    title: entry.title,
    sourceEntryPath: entry.sourceEntryPath,
    sourcePath: entry.rawPath,
    alias: {
      campaignId: entry.campaignUuid,
      resourceId: entry.plannedResourceUuid,
      importJobId: entry.importJobUuid,
      sourceRootId: entry.sourceRootId,
      rawPath: entry.rawPath,
      normalizedPath: entry.normalizedPath,
    },
    entryType: entry.entryType,
    declaredByteSize: entry.declaredByteSize,
    uploadSessionId: entry.uploadSessionUuid,
    explicit: entry.isExplicit,
    status: entry.status,
  }
}

function storedPlainTransferSnapshot(
  job: Doc<'resourceTransferJobs'>,
  entries: ReadonlyArray<Doc<'resourceTransferEntries'>>,
) {
  return {
    status: job.status,
    jobId: job.importJobUuid,
    destinationParentId: job.destinationParentUuid,
    textFileHandling: job.textFileHandling,
    sources: job.sources,
    entries: entries.map(storedPlanEntry),
  }
}

function unavailable() {
  return { status: 'unavailable' as const }
}

function plainTransferReceipt(
  job: Doc<'resourceTransferJobs'>,
  entries: ReadonlyArray<Doc<'resourceTransferEntries'>>,
): PlainTransferReceipt {
  if (entries.length === 0) throw new TypeError('Plain transfer has no entries')
  return {
    jobId: assertDomainId(DOMAIN_ID_KIND.importJob, job.importJobUuid),
    status: job.status,
    entries: entries.map(plainTransferEntryOutcome),
  }
}

function plainTransferEntryOutcome(
  entry: Doc<'resourceTransferEntries'>,
): PlainTransferReceipt['entries'][number] {
  if (entry.status === 'completed') {
    if (!entry.resourceUuid || !entry.resourceKind) {
      throw new TypeError('Completed plain transfer entry has no resource')
    }
    return {
      status: 'completed',
      sourceId: entry.sourceRootId,
      sourcePath: entry.rawPath,
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceUuid),
      kind: entry.resourceKind,
    }
  }
  if (entry.status === 'rejected') {
    return {
      status: 'rejected',
      sourceId: entry.sourceRootId,
      sourcePath: entry.rawPath,
      reason: entry.rejectionReason ?? 'invalid_command',
    }
  }
  return {
    status: entry.status,
    sourceId: entry.sourceRootId,
    sourcePath: entry.rawPath,
  }
}

async function createRetryUploadTargets(
  ctx: PlainTransferContext,
  entries: ReadonlyArray<Doc<'resourceTransferEntries'>>,
): Promise<Array<PlainTransferUploadTarget>> {
  const targets: Array<PlainTransferUploadTarget> = []
  for (const entry of entries) {
    if (entry.status !== 'pending' || !entry.uploadSessionUuid) continue
    const session = await ctx.db.get('fileStorage', entry.uploadSessionUuid)
    if (session?.status !== 'pending' || session.userId !== ctx.membership.userId) continue
    targets.push({
      sourceId: entry.sourceRootId,
      sourcePath: entry.sourceEntryPath,
      sessionId: entry.uploadSessionUuid,
      uploadUrl: await ctx.storage.generateUploadUrl(),
    })
  }
  return targets
}

async function discardReservedUpload(
  ctx: PlainTransferContext,
  sessionId: Id<'fileStorage'> | null,
): Promise<void> {
  if (!sessionId) return
  const session = await ctx.db.get('fileStorage', sessionId)
  if (!session || session.status === 'committed') return
  if (session.storageId) await ctx.storage.delete(session.storageId)
  await ctx.db.delete('fileStorage', sessionId)
}

async function loadPlainTransferJob(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  return await ctx.db
    .query('resourceTransferJobs')
    .withIndex('by_campaign_and_importJobUuid', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .unique()
}

async function loadOwnedPlainTransfer(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  const job = await loadPlainTransferJob(ctx, jobId)
  if (!job || job.actorMemberUuid !== ctx.resourceScope.actorId) return null
  return { job, entries: await loadPlainTransferEntries(ctx, jobId) }
}

async function loadPlainTransferEntries(ctx: PlainTransferReadContext, jobId: ImportJobId) {
  const entries = await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('importJobUuid', jobId),
    )
    .take(PLAIN_TRANSFER_LIMITS.maxEntries + 1)
  if (entries.length > PLAIN_TRANSFER_LIMITS.maxEntries) {
    throw new TypeError('Plain transfer entry limit exceeded')
  }
  return entries
}

async function loadPlainTransferEntry(
  ctx: PlainTransferReadContext,
  jobId: ImportJobId,
  sourceRootId: string,
  rawPath: string,
) {
  return await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job_and_source_and_path', (query) =>
      query
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .eq('importJobUuid', jobId)
        .eq('sourceRootId', sourceRootId)
        .eq('normalizedPath', normalizeSourcePath(rawPath)),
    )
    .unique()
}
