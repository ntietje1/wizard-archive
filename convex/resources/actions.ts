import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import {
  fileContentDigest,
  initialFileContentVersion,
} from '@wizard-archive/editor/resources/content-version'
import {
  buildPlainTransferInventory,
  digestPlainTransferSources,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type { PlainTransferSourceEntry } from '@wizard-archive/editor/resources/plain-transfer-inventory'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { TRANSFER_JOB_REQUEST_VERSION } from '@wizard-archive/editor/resources/transfer-job-contract'
import type {
  PlainTransferJobRequest,
  TransferSourceDescriptor,
} from '@wizard-archive/editor/resources/transfer-job-contract'
import { action } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
  fileContentReplaceResultValidator,
  mapContentMutationResultValidator,
  resourceStructureCommandResultValidator,
  versionStampValidator,
} from './schema'
import { importJobIdValidator, operationIdValidator, resourceIdValidator } from './validators'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
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

async function loadFileUpload(
  ctx: ActionCtx,
  campaignId: string,
  uploadSessionId: Id<'fileStorage'>,
): Promise<LoadedFileUpload | null> {
  const upload: StoredFileUpload = await ctx.runQuery(
    internal.resources.fileUpload.prepareFileUpload,
    { campaignId, uploadSessionId },
  )
  const blob = await ctx.storage.get(upload.storageId)
  if (!blob) throw new TypeError('Uploaded file bytes are unavailable')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { bytes, upload }
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

export const executePlainFileTransfer = action({
  args: {
    campaignId: v.string(),
    jobId: importJobIdValidator,
    operationId: operationIdValidator,
    destinationParentId: v.nullable(resourceIdValidator),
    uploadSessionId: v.id('fileStorage'),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const upload = await loadFileUpload(ctx, args.campaignId, args.uploadSessionId)
    if (!upload) return { status: 'rejected', reason: 'invalid_command' }
    const sources: ReadonlyArray<TransferSourceDescriptor> = [
      { id: 'selected-file', kind: 'file', name: upload.upload.originalFileName },
    ]
    const entries: ReadonlyArray<PlainTransferSourceEntry> = [
      {
        sourceId: 'selected-file',
        path: upload.upload.originalFileName,
        type: 'file',
        bytes: upload.bytes,
      },
    ]
    const request: PlainTransferJobRequest = {
      version: TRANSFER_JOB_REQUEST_VERSION,
      jobId: assertDomainId(DOMAIN_ID_KIND.importJob, args.jobId),
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      actorId: assertDomainId(DOMAIN_ID_KIND.campaignMember, upload.upload.actorId),
      destinationCampaignId: assertDomainId(DOMAIN_ID_KIND.campaign, upload.upload.campaignUuid),
      destinationParentId:
        args.destinationParentId === null
          ? null
          : assertDomainId(DOMAIN_ID_KIND.resource, args.destinationParentId),
      manifestHandling: 'reject',
      mode: 'plain_resources',
      sourceDigest: await digestPlainTransferSources(sources, entries),
      sources,
    }
    const planned = await buildPlainTransferInventory({ request, entries })
    if (planned.status === 'rejected') return { status: 'rejected', reason: 'invalid_command' }
    const resource = planned.inventory.resources[0]
    if (
      planned.inventory.resources.length !== 1 ||
      !resource ||
      resource.kind !== 'file' ||
      resource.content?.kind !== 'file'
    ) {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    return await ctx.runMutation(internal.resources.mutations.commitFileResourceCreation, {
      campaignId: upload.upload.campaignId,
      operationId: args.operationId,
      command: {
        type: 'create',
        resourceId: resource.id,
        kind: 'file',
        parentId: resource.parentId,
        title: resource.title,
        icon: null,
        color: null,
      },
      alias: resource.alias,
      metadataVersion: resource.metadataVersion,
      uploadSessionId: args.uploadSessionId,
      metadata: resource.content.source.metadata,
      version: await initialFileContentVersion(
        resource.content.source.bytes,
        resource.content.source.metadata,
      ),
    })
  },
})

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
