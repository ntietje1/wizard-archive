'use node'

import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import {
  fileContentDigest,
  initialFileContentVersion,
} from '@wizard-archive/editor/resources/content-version'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import type { ResourceSourceInspection } from '@wizard-archive/editor/resources/source-classifier'
import { action } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
  fileContentReplaceResultValidator,
  mapContentMutationResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
  versionStampValidator,
} from './schema'
import { operationIdValidator, resourceIdValidator } from './validators'
import { validateFileUpload } from '../../shared/storage/validation'
import { inspectFileSource } from './functions/fileSourceInspection'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type StoredFileUpload = Readonly<{
  campaignId: Id<'campaigns'>
  originalFileName: string
  storageId: Id<'_storage'>
}>

type InspectedFileUpload = Readonly<{
  bytes: Uint8Array
  metadata: Exclude<ReturnType<typeof classifyFileResourceSource>, { classification: 'rejected' }>
  upload: StoredFileUpload
}>

async function loadInspectedFileUpload(
  ctx: ActionCtx,
  campaignId: string,
  uploadSessionId: Id<'fileStorage'>,
): Promise<InspectedFileUpload | null> {
  const upload: StoredFileUpload = await ctx.runQuery(
    internal.resources.fileUpload.prepareFileUpload,
    { campaignId, uploadSessionId },
  )
  const blob = await ctx.storage.get(upload.storageId)
  if (!blob) throw new TypeError('Uploaded file bytes are unavailable')
  const validation = validateFileUpload(blob.type || null, blob.size, upload.originalFileName)
  if (!validation.valid) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const preliminary = classifyFileResourceSource({ bytes, fileName: upload.originalFileName })
  if (preliminary.classification === 'rejected') return null
  const inspection = await inspectSupportedFileSource(bytes, preliminary.detectedFormat)
  const metadata = classifyFileResourceSource({
    bytes,
    fileName: upload.originalFileName,
    inspection,
  })
  return metadata.classification === 'rejected' ? null : { bytes, metadata, upload }
}

async function inspectSupportedFileSource(
  bytes: Uint8Array,
  format: string | null,
): Promise<ResourceSourceInspection> {
  if (
    format !== 'png' &&
    format !== 'jpeg' &&
    format !== 'gif' &&
    format !== 'webp' &&
    format !== 'pdf' &&
    format !== 'mp4'
  ) {
    return {}
  }
  return await inspectFileSource(bytes, format)
}

export const createFileResource = action({
  args: {
    campaignId: v.string(),
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    uploadSessionId: v.id('fileStorage'),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const upload = await loadInspectedFileUpload(ctx, args.campaignId, args.uploadSessionId)
    if (!upload) {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    return await ctx.runMutation(internal.resources.mutations.commitFileResourceCreation, {
      campaignId: upload.upload.campaignId,
      operationId: args.operationId,
      command: args.command,
      uploadSessionId: args.uploadSessionId,
      metadata: upload.metadata,
      version: await initialFileContentVersion(upload.bytes, upload.metadata),
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
    const upload = await loadInspectedFileUpload(ctx, args.campaignId, args.uploadSessionId)
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
    const upload = await loadInspectedFileUpload(ctx, args.campaignId, args.uploadSessionId)
    if (!upload || upload.metadata.classification !== 'viewable_image') {
      return { status: 'rejected', reason: 'invalid_image' }
    }
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
