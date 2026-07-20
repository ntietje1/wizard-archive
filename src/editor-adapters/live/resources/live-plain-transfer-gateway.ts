import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { createPlainTransferManifest } from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type {
  PlainTransferGateway,
  PlainTransferInputEntry,
  PlainTransferProgress,
  PlainTransferReceipt,
} from '@wizard-archive/editor/resources/transfer-job-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

type ReserveArgs = FunctionArgs<typeof api.resources.mutations.reservePlainTransfer>
type ReserveResult = FunctionReturnType<typeof api.resources.mutations.reservePlainTransfer>
type CommitArgs = FunctionArgs<typeof api.resources.actions.commitPlainTransfer>
type CommitResult = FunctionReturnType<typeof api.resources.actions.commitPlainTransfer>
type CancelArgs = FunctionArgs<typeof api.resources.mutations.cancelPlainTransfer>
type LoadArgs = FunctionArgs<typeof api.resources.queries.loadPlainTransfer>
type LoadResult = FunctionReturnType<typeof api.resources.queries.loadPlainTransfer>

type UploadTarget = Extract<ReserveResult, { status: 'reserved' }>['uploadTargets'][number]

type LivePlainTransferBackend = Readonly<{
  bind(
    target: UploadTarget,
    source: Extract<PlainTransferInputEntry, { type: 'file' }>,
  ): Promise<void>
  cancel(args: CancelArgs): Promise<LoadResult>
  commit(args: CommitArgs): Promise<CommitResult>
  load(args: LoadArgs): Promise<LoadResult>
  refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
  reserve(args: ReserveArgs): Promise<ReserveResult>
}>

export function createLivePlainTransferGateway(
  campaignId: CampaignId,
  backend: LivePlainTransferBackend,
): PlainTransferGateway {
  return {
    execute: async (intent, sources, entries, options) => {
      const manifest = createPlainTransferManifest({ intent, sources, entries })
      let reservation: ReserveResult
      try {
        reservation = await backend.reserve({
          campaignId,
          jobId: manifest.jobId,
          destinationParentId: manifest.destinationParentId,
          textFileHandling: manifest.textFileHandling,
          sources: [...manifest.sources],
          entries: [...manifest.entries],
        })
      } catch {
        return { status: 'indeterminate', reason: 'transport_unavailable' }
      }
      if (reservation.status === 'rejected') return reservation

      const cancel = () => {
        void backend.cancel({ campaignId, jobId: intent.jobId }).catch(() => undefined)
      }
      options?.signal?.addEventListener('abort', cancel, { once: true })
      try {
        if (options?.signal?.aborted) {
          return await cancelPlainTransfer(backend, campaignId, intent.jobId)
        }
        await uploadReservedEntries(
          backend,
          reservation.uploadTargets,
          entries,
          options?.onProgress,
        )
        if (options?.signal?.aborted) {
          return await cancelPlainTransfer(backend, campaignId, intent.jobId)
        }
        const result = await backend.commit({ campaignId, jobId: intent.jobId })
        const response =
          result.status === 'indeterminate'
            ? await recoverPlainTransfer(backend, campaignId, intent.jobId, result)
            : result
        if (response.status === 'indeterminate' || response.status === 'rejected') {
          return response
        }
        const receipt = readPlainTransferReceipt(response)
        if (receipt.status === 'settled') {
          await refreshCompletedEntries(backend, receipt, intent.destinationParentId)
          reportSettledProgress(entries, receipt, options?.onProgress)
        }
        return receipt
      } catch {
        return await recoverPlainTransfer(backend, campaignId, intent.jobId, {
          status: 'indeterminate',
          reason: 'response_lost',
        })
      } finally {
        options?.signal?.removeEventListener('abort', cancel)
      }
    },
  }
}

async function uploadReservedEntries(
  backend: Pick<LivePlainTransferBackend, 'bind'>,
  targets: ReadonlyArray<UploadTarget>,
  entries: ReadonlyArray<PlainTransferInputEntry>,
  onProgress: ((progress: PlainTransferProgress) => void) | undefined,
): Promise<void> {
  const files = new Map(
    entries.flatMap((entry) =>
      entry.type === 'file' ? [[transferEntryKey(entry.sourceId, entry.path), entry] as const] : [],
    ),
  )
  const totalBytes = totalFileBytes(entries)
  let uploadedBytes =
    totalBytes -
    targets.reduce((total, target) => {
      const source = files.get(transferEntryKey(target.sourceId, target.sourcePath))
      if (!source) throw new TypeError('Reserved upload target is not in the local manifest')
      return total + source.bytes.byteLength
    }, 0)
  for (const [index, target] of targets.entries()) {
    const source = files.get(transferEntryKey(target.sourceId, target.sourcePath))
    if (!source) throw new TypeError('Reserved upload target is not in the local manifest')
    onProgress?.({
      completedEntries: index,
      totalEntries: entries.length,
      uploadedBytes,
      totalBytes,
      currentPath: source.path,
    })
    await backend.bind(target, source)
    uploadedBytes += source.bytes.byteLength
  }
}

async function cancelPlainTransfer(
  backend: Pick<LivePlainTransferBackend, 'cancel'>,
  campaignId: CampaignId,
  jobId: FunctionArgs<typeof api.resources.mutations.cancelPlainTransfer>['jobId'],
) {
  const result = await backend.cancel({ campaignId, jobId })
  return result.status === 'unavailable'
    ? ({ status: 'rejected', reason: 'invalid_job' } as const)
    : readPlainTransferReceipt(result)
}

async function recoverPlainTransfer(
  backend: Pick<LivePlainTransferBackend, 'load'>,
  campaignId: CampaignId,
  jobId: FunctionArgs<typeof api.resources.queries.loadPlainTransfer>['jobId'],
  fallback: Extract<CommitResult, { status: 'indeterminate' }>,
) {
  try {
    const receipt = await backend.load({ campaignId, jobId })
    return receipt.status === 'unavailable' ? fallback : readPlainTransferReceipt(receipt)
  } catch {
    return fallback
  }
}

async function refreshCompletedEntries(
  backend: Pick<LivePlainTransferBackend, 'refresh'>,
  receipt: PlainTransferReceipt,
  destinationParentId: ResourceId | null,
): Promise<void> {
  await Promise.all(
    receipt.entries.flatMap((entry) =>
      entry.status === 'completed' ? [backend.refresh(entry.resourceId, destinationParentId)] : [],
    ),
  )
}

function reportSettledProgress(
  entries: ReadonlyArray<PlainTransferInputEntry>,
  receipt: PlainTransferReceipt,
  onProgress: ((progress: PlainTransferProgress) => void) | undefined,
): void {
  onProgress?.({
    completedEntries: receipt.entries.filter((entry) => entry.status === 'completed').length,
    totalEntries: receipt.entries.length,
    uploadedBytes: totalFileBytes(entries),
    totalBytes: totalFileBytes(entries),
    currentPath: null,
  })
}

function totalFileBytes(entries: ReadonlyArray<PlainTransferInputEntry>): number {
  return entries.reduce(
    (total, entry) => total + (entry.type === 'file' ? entry.bytes.byteLength : 0),
    0,
  )
}

function transferEntryKey(sourceId: string, path: string): string {
  return `${sourceId}\0${path}`
}

function readPlainTransferReceipt(
  receipt:
    | PlainTransferReceipt
    | Extract<CommitResult, { status: 'reserved' | 'running' | 'settled' }>,
): PlainTransferReceipt {
  return {
    jobId: assertDomainId(DOMAIN_ID_KIND.importJob, receipt.jobId),
    status: receipt.status,
    entries: receipt.entries.map((entry) =>
      entry.status === 'completed'
        ? {
            ...entry,
            resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceId),
          }
        : entry,
    ),
  }
}
