import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
} from './schema'
import { operationIdValidator } from './validators'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type PreparedFileResourceCreation = Readonly<{
  campaignId: Id<'campaigns'>
  originalFileName: string
  storageId: Id<'_storage'>
}>

export const createFileResource = action({
  args: {
    campaignId: v.string(),
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    uploadSessionId: v.id('fileStorage'),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const source: PreparedFileResourceCreation = await ctx.runQuery(
      internal.resources.fileCreation.prepareFileResourceCreation,
      {
        campaignId: args.campaignId,
        uploadSessionId: args.uploadSessionId,
      },
    )
    const blob = await ctx.storage.get(source.storageId)
    if (!blob) throw new TypeError('Uploaded file bytes are unavailable')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const metadata = classifyFileResourceSource({
      bytes,
      fileName: source.originalFileName,
    })
    if (metadata.classification === 'rejected') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    return await ctx.runMutation(internal.resources.mutations.commitFileResourceCreation, {
      campaignId: source.campaignId,
      operationId: args.operationId,
      command: args.command,
      uploadSessionId: args.uploadSessionId,
      metadata,
      version: await initialFileContentVersion(bytes, metadata),
    })
  },
})
