import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import {
  fileContentDigest,
  initialFileContentVersion,
} from '@wizard-archive/editor/resources/content-version'
import {
  materializePlainTransferInventory,
  PLAIN_TRANSFER_LIMITS,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type { PlainTransferInventoryResource } from '@wizard-archive/editor/resources/plain-transfer-inventory'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { markdownToNoteYDoc } from '@wizard-archive/editor/notes/document-yjs'
import { storedPlainTransferPlan } from './functions/plainTransfer'
import type { PlainTransferInputEntry } from '@wizard-archive/editor/resources/transfer-job-contract'
import * as Y from 'yjs'
import { action } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import type { FunctionReturnType } from 'convex/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
  fileContentReplaceResultValidator,
  mapContentMutationResultValidator,
  plainTransferReceiptValidator,
  versionStampValidator,
} from './schema'
import { importJobIdValidator, resourceIdValidator } from './validators'

type StoredFileUpload = Readonly<{
  campaignId: Id<'campaigns'>
  campaignUuid: string
  actorId: string
  originalFileName: string
  storageId: Id<'_storage'>
  byteSize: number
}>

type ClassifiedFileUpload = Readonly<{
  bytes: Uint8Array
  metadata: Exclude<ReturnType<typeof classifyFileResourceSource>, { classification: 'rejected' }>
  upload: StoredFileUpload
}>

type LoadedFileUpload = Readonly<{
  bytes: Uint8Array
  upload: StoredFileUpload
}>

async function loadFileUpload(
  ctx: ActionCtx,
  campaignId: string,
  uploadSessionId: Id<'fileStorage'>,
): Promise<LoadedFileUpload | null> {
  const upload = await prepareFileUpload(ctx, campaignId, uploadSessionId)
  const bytes = await loadFileUploadBytes(ctx, upload)
  return { bytes, upload }
}

async function prepareFileUpload(
  ctx: ActionCtx,
  campaignId: string,
  uploadSessionId: Id<'fileStorage'>,
): Promise<StoredFileUpload> {
  return await ctx.runQuery(internal.resources.fileUpload.prepareFileUpload, {
    campaignId,
    uploadSessionId,
  })
}

async function loadFileUploadBytes(ctx: ActionCtx, upload: StoredFileUpload): Promise<Uint8Array> {
  const blob = await ctx.storage.get(upload.storageId)
  if (!blob) throw new TypeError('Uploaded file bytes are unavailable')
  return new Uint8Array(await blob.arrayBuffer())
}

async function loadClassifiedFileUpload(
  ctx: ActionCtx,
  campaignId: string,
  uploadSessionId: Id<'fileStorage'>,
): Promise<ClassifiedFileUpload | null> {
  const loaded = await loadFileUpload(ctx, campaignId, uploadSessionId)
  if (!loaded) return null
  const { bytes, upload } = loaded
  const metadata = classifyFileResourceSource({
    bytes,
    fileName: upload.originalFileName,
  })
  return metadata.classification === 'rejected' ? null : { bytes, metadata, upload }
}

const plainTransferExecutionResultValidator = v.union(
  plainTransferReceiptValidator,
  v.object({
    status: v.literal('indeterminate'),
    reason: v.union(v.literal('response_lost'), v.literal('transport_unavailable')),
  }),
  v.object({ status: v.literal('rejected'), reason: v.string() }),
)
type StoredPlainTransferExecutionResult = Infer<typeof plainTransferExecutionResultValidator>

export const commitPlainTransfer = action({
  args: {
    campaignId: v.string(),
    jobId: importJobIdValidator,
  },
  returns: plainTransferExecutionResultValidator,
  handler: async (ctx, args): Promise<StoredPlainTransferExecutionResult> => {
    const scope = await ctx.runQuery(internal.resources.queries.loadPlainTransferScope, {
      campaignId: args.campaignId,
    })
    const snapshot = await ctx.runMutation(internal.resources.mutations.startPlainTransfer, {
      campaignId: scope.campaignId,
      jobId: args.jobId,
    })
    if (snapshot.status === 'unavailable') {
      return { status: 'rejected', reason: 'invalid_job' }
    }
    if (snapshot.status === 'settled') {
      return await finishPlainTransfer(ctx, scope.campaignId, args.jobId)
    }
    let entries: ReadonlyArray<PlainTransferInputEntry>
    try {
      entries = await loadPlainTransferSourceEntries(ctx, args.campaignId, scope, snapshot)
    } catch {
      return await rejectPlainTransfer(ctx, scope.campaignId, args.jobId, 'invalid_source')
    }
    try {
      const inventory = await materializePlainTransferInventory(
        storedPlainTransferPlan(snapshot),
        entries,
      )
      if (inventory.status === 'rejected') {
        return await rejectPlainTransfer(ctx, scope.campaignId, args.jobId, inventory.reason)
      }
      for (const resource of [...inventory.inventory.resources].sort(
        (left, right) =>
          pathDepth(left.sourcePath) - pathDepth(right.sourcePath) ||
          left.sourcePath.localeCompare(right.sourcePath),
      )) {
        await commitPlainTransferResource(ctx, scope.campaignId, args.jobId, resource)
      }
      return await finishPlainTransfer(ctx, scope.campaignId, args.jobId)
    } catch {
      return { status: 'indeterminate', reason: 'response_lost' }
    }
  },
})

async function finishPlainTransfer(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
): Promise<StoredPlainTransferExecutionResult> {
  const receipt = await ctx.runMutation(internal.resources.mutations.finishPlainTransfer, {
    campaignId,
    jobId,
  })
  return receipt.status === 'unavailable'
    ? { status: 'indeterminate', reason: 'response_lost' }
    : receipt
}

async function rejectPlainTransfer(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
  reason: string,
): Promise<StoredPlainTransferExecutionResult> {
  const receipt = await ctx.runMutation(internal.resources.mutations.rejectPlainTransfer, {
    campaignId,
    jobId,
    reason,
  })
  return receipt.status === 'unavailable' ? { status: 'rejected', reason: 'invalid_job' } : receipt
}

type PlainTransferSnapshot = Exclude<
  FunctionReturnType<typeof internal.resources.mutations.startPlainTransfer>,
  { status: 'unavailable' }
>

async function loadPlainTransferSourceEntries(
  ctx: ActionCtx,
  campaignId: string,
  scope: Readonly<{ actorId: string; campaignId: Id<'campaigns'> }>,
  snapshot: PlainTransferSnapshot,
): Promise<ReadonlyArray<PlainTransferInputEntry>> {
  const files = snapshot.entries.filter(
    (entry) => entry.status === 'pending' && entry.entryType === 'file',
  )
  if (files.length > PLAIN_TRANSFER_LIMITS.maxEntries) {
    throw new TypeError('Plain transfer entry limit exceeded')
  }
  const prepared = await Promise.all(
    files.map(async (entry) => {
      if (!entry.uploadSessionId) throw new TypeError('Upload session is unavailable')
      const upload = await prepareFileUpload(ctx, campaignId, entry.uploadSessionId)
      if (
        upload.campaignId !== scope.campaignId ||
        upload.actorId !== scope.actorId ||
        upload.byteSize !== entry.declaredByteSize ||
        upload.originalFileName !== pathBasename(entry.sourceEntryPath)
      ) {
        throw new TypeError('Reserved upload does not match its manifest entry')
      }
      return { entry, upload }
    }),
  )
  if (
    prepared.reduce((total, item) => total + item.upload.byteSize, 0) >
    PLAIN_TRANSFER_LIMITS.maxTotalBytes
  ) {
    throw new TypeError('Plain transfer byte limit exceeded')
  }
  const bytesByEntry = new Map(
    await Promise.all(
      prepared.map(
        async ({ entry, upload }) =>
          [
            transferEntryKey(entry.alias.sourceRootId, entry.sourceEntryPath),
            await loadFileUploadBytes(ctx, upload),
          ] as const,
      ),
    ),
  )
  const entries: Array<PlainTransferInputEntry> = []
  for (const entry of snapshot.entries) {
    if (entry.status !== 'pending' || !entry.explicit) continue
    if (entry.entryType === 'directory') {
      entries.push({
        sourceId: entry.alias.sourceRootId,
        path: entry.sourceEntryPath,
        type: 'directory',
      })
      continue
    }
    const bytes = bytesByEntry.get(
      transferEntryKey(entry.alias.sourceRootId, entry.sourceEntryPath),
    )
    if (!bytes) throw new TypeError('Uploaded file bytes are unavailable')
    entries.push({
      sourceId: entry.alias.sourceRootId,
      path: entry.sourceEntryPath,
      type: 'file',
      bytes,
    })
  }
  return entries
}

async function commitPlainTransferResource(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
  resource: PlainTransferInventoryResource,
): Promise<void> {
  const common = {
    campaignId,
    jobId,
    sourceId: resource.alias.sourceRootId,
    sourcePath: resource.alias.rawPath,
  }
  if (resource.kind === 'folder') {
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferFolder, common)
    return
  }
  if (resource.kind === 'note') {
    const document = markdownToNoteYDoc(resource.content.source.text)
    let update: ArrayBuffer
    try {
      update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    } finally {
      document.destroy()
    }
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferNote, {
      ...common,
      update,
    })
    return
  }
  if (resource.kind === 'file') {
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferFile, {
      ...common,
      metadata: resource.content.source.metadata,
      version: await initialFileContentVersion(
        resource.content.source.bytes,
        resource.content.source.metadata,
      ),
    })
    return
  }
  throw new TypeError('Plain transfer inventory contains an unsupported resource')
}

function transferEntryKey(sourceId: string, path: string): string {
  return `${sourceId}\0${path}`
}

function pathBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function pathDepth(path: string): number {
  return path.split('/').length
}

type StoredFileContentReplaceResult = Infer<typeof fileContentReplaceResultValidator>

export const replaceFileContent = action({
  args: {
    campaignId: v.string(),
    resourceId: resourceIdValidator,
    expectedVersion: versionStampValidator,
    uploadSessionId: v.id('fileStorage'),
  },
  returns: fileContentReplaceResultValidator,
  handler: async (ctx, args): Promise<StoredFileContentReplaceResult> => {
    const upload = await loadClassifiedFileUpload(ctx, args.campaignId, args.uploadSessionId)
    if (!upload) return { status: 'rejected', reason: 'invalid_file' }
    return await ctx.runMutation(internal.resources.mutations.commitFileContentReplacement, {
      campaignId: upload.upload.campaignId,
      resourceId: args.resourceId,
      expectedVersion: args.expectedVersion,
      uploadSessionId: args.uploadSessionId,
      metadata: upload.metadata,
      digest: await fileContentDigest(upload.bytes, upload.metadata),
    })
  },
})

type StoredMapContentMutationResult = Infer<typeof mapContentMutationResultValidator>

export const replaceMapImage = action({
  args: {
    campaignId: v.string(),
    resourceId: resourceIdValidator,
    expectedVersion: versionStampValidator,
    layerId: v.nullable(v.string()),
    uploadSessionId: v.id('fileStorage'),
  },
  returns: mapContentMutationResultValidator,
  handler: async (ctx, args): Promise<StoredMapContentMutationResult> => {
    const upload = await loadClassifiedFileUpload(ctx, args.campaignId, args.uploadSessionId)
    if (!upload) return { status: 'rejected', reason: 'invalid_command' }
    return await ctx.runMutation(internal.resources.mutations.commitMapImageReplacement, {
      campaignId: upload.upload.campaignId,
      resourceId: args.resourceId,
      expectedVersion: args.expectedVersion,
      layerId: args.layerId,
      uploadSessionId: args.uploadSessionId,
      image: {
        byteSize: upload.bytes.byteLength,
        digest: await sha256Digest(upload.bytes),
        mediaType: upload.metadata.mediaType,
      },
    })
  },
})
