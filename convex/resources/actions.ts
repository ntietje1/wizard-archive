import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import {
  fileContentDigest,
  initialFileContentVersion,
} from '@wizard-archive/editor/resources/content-version'
import {
  planPlainTransfer,
  plainTransferEntryIdentities,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type {
  PlainTransferInventoryResource,
  PlainTransferSourceEntry,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { PlainTransferSourceDescriptor } from '@wizard-archive/editor/resources/transfer-job-contract'
import { action } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
  fileContentReplaceResultValidator,
  mapContentMutationResultValidator,
  versionStampValidator,
} from './schema'
import { importJobIdValidator, operationIdValidator, resourceIdValidator } from './validators'

type StoredFileUpload = Readonly<{
  campaignId: Id<'campaigns'>
  campaignUuid: string
  actorId: string
  originalFileName: string
  storageId: Id<'_storage'>
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

type PlainTransferUpload = Readonly<{
  sessionId: Id<'fileStorage'>
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

const transferSourceDescriptorValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal('directory'), v.literal('file'), v.literal('zip')),
  name: v.string(),
})

const transferInputEntryValidator = v.union(
  v.object({
    sourceId: v.string(),
    path: v.string(),
    type: v.literal('directory'),
  }),
  v.object({
    sourceId: v.string(),
    path: v.string(),
    type: v.literal('file'),
    uploadSessionId: v.id('fileStorage'),
    noteUpdate: v.optional(v.bytes()),
  }),
)

const transferEntryOutcomeValidator = v.union(
  v.object({
    status: v.literal('completed'),
    sourceId: v.string(),
    sourcePath: v.string(),
    resourceId: resourceIdValidator,
    kind: v.union(
      v.literal('folder'),
      v.literal('note'),
      v.literal('file'),
      v.literal('map'),
      v.literal('canvas'),
    ),
  }),
  v.object({
    status: v.literal('rejected'),
    sourceId: v.string(),
    sourcePath: v.string(),
    reason: v.string(),
  }),
)

const plainTransferExecutionResultValidator = v.union(
  v.object({
    status: v.literal('completed'),
    entries: v.array(transferEntryOutcomeValidator),
  }),
  v.object({ status: v.literal('cancelled') }),
  v.object({
    status: v.literal('indeterminate'),
    reason: v.union(v.literal('response_lost'), v.literal('transport_unavailable')),
  }),
  v.object({ status: v.literal('rejected'), reason: v.string() }),
)
type StoredPlainTransferExecutionResult = Infer<typeof plainTransferExecutionResultValidator>
type StoredPlainTransferInputEntry = Infer<typeof transferInputEntryValidator>

type PreparedPlainTransferSource =
  | Readonly<{ status: 'ready'; entry: PlainTransferSourceEntry }>
  | Readonly<{
      status: 'ready'
      entry: PlainTransferSourceEntry
      key: string
      noteUpdate: ArrayBuffer | null
      upload: PlainTransferUpload
    }>
  | Readonly<{ status: 'rejected' }>

async function preparePlainTransferSources(
  ctx: ActionCtx,
  {
    actorId,
    campaignId,
    campaignRowId,
    input,
  }: Readonly<{
    actorId: string
    campaignId: string
    campaignRowId: Id<'campaigns'>
    input: ReadonlyArray<StoredPlainTransferInputEntry>
  }>,
): Promise<
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<PlainTransferSourceEntry>
      noteUpdates: ReadonlyMap<string, ArrayBuffer>
      uploads: ReadonlyMap<string, PlainTransferUpload>
    }>
  | Readonly<{ status: 'rejected' }>
> {
  const prepared = await Promise.all(
    input.map(async (entry): Promise<PreparedPlainTransferSource> => {
      if (entry.type === 'directory') return { status: 'ready', entry }
      const upload = await prepareFileUpload(ctx, campaignId, entry.uploadSessionId)
      if (upload.campaignId !== campaignRowId || upload.actorId !== actorId) {
        return { status: 'rejected' }
      }
      return {
        status: 'ready',
        entry: {
          sourceId: entry.sourceId,
          path: entry.path,
          type: 'file',
          bytes: await loadFileUploadBytes(ctx, upload),
        },
        key: transferEntryKey(entry.sourceId, entry.path),
        noteUpdate: entry.noteUpdate ?? null,
        upload: { sessionId: entry.uploadSessionId, upload },
      }
    }),
  )
  if (prepared.some((source) => source.status === 'rejected')) return { status: 'rejected' }

  const entries: Array<PlainTransferSourceEntry> = []
  const noteUpdates = new Map<string, ArrayBuffer>()
  const uploads = new Map<string, PlainTransferUpload>()
  for (const source of prepared) {
    if (source.status === 'rejected') continue
    entries.push(source.entry)
    if (!('upload' in source)) continue
    uploads.set(source.key, source.upload)
    if (source.noteUpdate) noteUpdates.set(source.key, source.noteUpdate)
  }
  return { status: 'ready', entries, noteUpdates, uploads }
}

export const executePlainTransfer = action({
  args: {
    campaignId: v.string(),
    jobId: importJobIdValidator,
    operationId: operationIdValidator,
    destinationParentId: v.nullable(resourceIdValidator),
    textFileHandling: v.union(v.literal('files'), v.literal('notes')),
    sources: v.array(transferSourceDescriptorValidator),
    entries: v.array(transferInputEntryValidator),
  },
  returns: plainTransferExecutionResultValidator,
  handler: async (ctx, args): Promise<StoredPlainTransferExecutionResult> => {
    const scope = await ctx.runQuery(internal.resources.queries.loadPlainTransferScope, {
      campaignId: args.campaignId,
    })
    const sources: ReadonlyArray<PlainTransferSourceDescriptor> = args.sources
    const prepared = await preparePlainTransferSources(ctx, {
      actorId: scope.actorId,
      campaignId: args.campaignId,
      campaignRowId: scope.campaignId,
      input: args.entries,
    })
    if (prepared.status === 'rejected') return { status: 'rejected', reason: 'invalid_source' }
    const { entries, noteUpdates, uploads } = prepared
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, scope.campaignUuid)
    const planned = await planPlainTransfer({
      actorId: assertDomainId(DOMAIN_ID_KIND.campaignMember, scope.actorId),
      campaignId,
      entries,
      intent: {
        campaignId,
        jobId: assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId),
        operationId: assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
        destinationParentId:
          args.destinationParentId === null
            ? null
            : assertDomainId(DOMAIN_ID_KIND.resource, args.destinationParentId),
        textFileHandling: args.textFileHandling,
      },
      sources,
    })
    if (planned.status === 'rejected') return { status: 'rejected', reason: planned.reason }
    const inventory = planned.inventory
    if (
      !inventory.resources.every((resource) =>
        transferResourceContentAvailable(resource, uploads, noteUpdates),
      )
    ) {
      return { status: 'rejected', reason: 'invalid_inventory' }
    }
    const start = await ctx.runMutation(internal.resources.mutations.beginPlainTransfer, {
      campaignId: scope.campaignId,
      jobId: args.jobId,
      operationId: args.operationId,
      destinationParentId: args.destinationParentId,
      sourceDigest: inventory.sourceDigest,
      entries: [...plainTransferEntryIdentities(inventory.resources)],
    })
    if (start.status === 'cancelled') return { status: 'cancelled' }
    if (start.status === 'rejected') {
      const replay = await loadCompletedPlainTransfer(ctx, scope.campaignId, args.jobId)
      return replay.status === 'indeterminate'
        ? { status: 'rejected', reason: 'invalid_job' }
        : replay
    }
    if (start.status === 'completed' || start.status === 'completed_with_issues') {
      return await loadCompletedPlainTransfer(ctx, scope.campaignId, args.jobId)
    }
    await commitPlainTransferInventory(
      ctx,
      scope.campaignId,
      args.jobId,
      inventory.sourceDigest,
      inventory.resources,
      uploads,
      noteUpdates,
    )
    await ctx.runMutation(internal.resources.mutations.finishPlainTransfer, {
      campaignId: scope.campaignId,
      jobId: args.jobId,
    })
    return await loadCompletedPlainTransfer(ctx, scope.campaignId, args.jobId)
  },
})

async function loadCompletedPlainTransfer(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
): Promise<StoredPlainTransferExecutionResult> {
  const snapshot = await ctx.runQuery(internal.resources.queries.loadPlainTransferInternal, {
    campaignId,
    jobId,
  })
  if (snapshot.status === 'unavailable' || snapshot.status === 'pending') {
    return { status: 'indeterminate', reason: 'response_lost' }
  }
  if (snapshot.status === 'cancelled') return { status: 'cancelled' }
  return {
    status: 'completed',
    entries: snapshot.entries.map((entry) =>
      entry.status === 'completed' && entry.resourceId !== null
        ? {
            status: 'completed',
            sourceId: entry.sourceRootId,
            sourcePath: entry.rawPath,
            resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceId),
            kind: entry.resourceKind,
          }
        : {
            status: 'rejected',
            sourceId: entry.sourceRootId,
            sourcePath: entry.rawPath,
            reason: entry.rejectionReason ?? 'invalid_command',
          },
    ),
  }
}

async function commitPlainTransferResource(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
  sourceDigest: string,
  resource: PlainTransferInventoryResource,
  upload: PlainTransferUpload | null,
  noteUpdate: ArrayBuffer | null,
): Promise<void> {
  const common = {
    campaignId,
    jobId,
    operationId: resource.operationId,
    sourceDigest,
    command: {
      type: 'create' as const,
      resourceId: resource.id,
      kind: resource.kind,
      parentId: resource.parentId,
      title: resource.title,
      icon: null,
      color: null,
    },
    alias: resource.alias,
    metadataVersion: resource.metadataVersion,
  }
  if (resource.kind === 'folder') {
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferFolder, common)
    return
  }
  if (resource.kind === 'note' && noteUpdate) {
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferNote, {
      ...common,
      update: noteUpdate,
    })
    return
  }
  if (resource.kind === 'file' && upload) {
    await ctx.runMutation(internal.resources.mutations.commitPlainTransferFile, {
      ...common,
      uploadSessionId: upload.sessionId,
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

async function commitPlainTransferInventory(
  ctx: ActionCtx,
  campaignId: Id<'campaigns'>,
  jobId: string,
  sourceDigest: string,
  resources: ReadonlyArray<PlainTransferInventoryResource>,
  uploads: ReadonlyMap<string, PlainTransferUpload>,
  noteUpdates: ReadonlyMap<string, ArrayBuffer>,
): Promise<void> {
  const commits = new Map<string, Promise<void>>()
  for (const resource of resources) {
    const parentCommit = resource.parentId === null ? undefined : commits.get(resource.parentId)
    const commit = (parentCommit ?? Promise.resolve()).then(() =>
      commitPlainTransferResource(
        ctx,
        campaignId,
        jobId,
        sourceDigest,
        resource,
        uploads.get(transferEntryKey(resource.alias.sourceRootId, resource.sourceEntryPath)) ??
          null,
        noteUpdates.get(transferEntryKey(resource.alias.sourceRootId, resource.sourceEntryPath)) ??
          null,
      ),
    )
    commits.set(resource.id, commit)
  }
  await Promise.all(commits.values())
}

function transferEntryKey(sourceId: string, path: string): string {
  return `${sourceId}\0${path}`
}

function transferResourceContentAvailable(
  resource: PlainTransferInventoryResource,
  uploads: ReadonlyMap<string, PlainTransferUpload>,
  noteUpdates: ReadonlyMap<string, ArrayBuffer>,
): boolean {
  if (resource.kind === 'folder') return true
  const key = transferEntryKey(resource.alias.sourceRootId, resource.sourceEntryPath)
  return resource.kind === 'note' ? noteUpdates.has(key) : uploads.has(key)
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
