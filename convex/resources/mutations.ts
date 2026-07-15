import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type {
  ResourceCompensationResult,
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { resourceStructureInputRejection } from '@wizard-archive/editor/resources/command-protocol'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { FILE_CLASSIFICATION } from '@wizard-archive/editor/resources/file-content-contract'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { campaignMutation, dmMutation } from '../functions'
import type { CampaignMutationCtx } from '../functions'
import {
  executeStructureCommand as executeStructureCommandFn,
  compensateResourceOperation as compensateResourceOperationFn,
} from './functions/executeStructureCommand'
import {
  fileOwnedMetadataValidators,
  resourceCompensationResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
  resourceBookmarkCommandResultValidator,
  resourceBookmarkCommandValidator,
  saveNoteContentResultValidator,
  versionStampValidator,
} from './schema'
import { saveNoteContent as saveNoteContentFn } from './functions/saveNoteContent'
import { operationIdValidator, resourceIdValidator } from './validators'
import { executeBookmarkCommand as executeBookmarkCommandFn } from './functions/executeBookmarkCommand'
import { commitUpload } from '../storage/functions/commitUpload'
import { createNoteContent, prepareNoteContentCreation } from './functions/noteContent'
import { createMapContent } from './functions/mapContent'
import { createCanvasContent } from './functions/canvasContent'
import { syncNoteSearchProjection } from './functions/resourceSearchProjection'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type StoredResourceCompensationResult = Infer<typeof resourceCompensationResultValidator>
type StoredResourceCommandReceipt = Extract<
  StoredResourceStructureCommandResult,
  { status: 'completed' }
>['receipt']
type StoredResourceStructureCommand = Infer<typeof resourceStructureCommandValidator>

function readStructureCommand(
  value: StoredResourceStructureCommand,
): ResourceStructureCommand | StoredResourceStructureCommandResult {
  try {
    return resourceStructureCommand(value)
  } catch (error) {
    return { status: 'rejected', reason: resourceStructureInputRejection(error) }
  }
}

async function createFixedContentResource(
  ctx: CampaignMutationCtx,
  args: Readonly<{ operationId: string; command: StoredResourceStructureCommand }>,
  kind: 'canvas' | 'map',
  createContent: (
    ctx: CampaignMutationCtx,
    campaignId: CampaignMutationCtx['resourceScope']['campaignId'],
    resourceId: Extract<ResourceStructureCommand, { type: 'create' }>['resourceId'],
  ) => Promise<void>,
): Promise<StoredResourceStructureCommandResult> {
  const command = readStructureCommand(args.command)
  if ('status' in command) return command
  if (command.type !== 'create' || command.kind !== kind) {
    return { status: 'rejected', reason: 'invalid_command' }
  }
  const result = await executeStructureCommandFn(ctx, {
    operationId: args.operationId,
    command,
  })
  if (result.status !== 'completed') return storedResult(result)
  await createContent(ctx, ctx.resourceScope.campaignId, command.resourceId)
  return storedResult(result)
}

function storedReceipt(receipt: ResourceCommandReceipt): StoredResourceCommandReceipt {
  return {
    campaignId: receipt.campaignId,
    operationId: receipt.operationId,
    result:
      receipt.result.type === 'created' || receipt.result.type === 'metadataUpdated'
        ? { type: receipt.result.type, resourceId: receipt.result.resourceId }
        : receipt.result.type === 'deepCopied'
          ? { type: 'deepCopied', roots: receipt.result.roots.map((root) => ({ ...root })) }
          : { type: receipt.result.type, resourceIds: [...receipt.result.resourceIds] },
    postconditions: receipt.postconditions.map((condition) =>
      condition.state === 'missing'
        ? { state: 'missing', resourceId: condition.resourceId }
        : {
            state: 'present',
            resourceId: condition.resourceId,
            metadataVersion: { ...condition.metadataVersion },
          },
    ),
  }
}

function storedResult(
  result: ResourceStructureCommandResult,
): StoredResourceStructureCommandResult {
  if (result.status === 'completed') {
    return { status: 'completed', receipt: storedReceipt(result.receipt) }
  }
  if (result.status === 'rejected') return { status: 'rejected', reason: result.reason }
  return { status: 'unavailable', reason: result.reason }
}

function storedCompensationResult(
  result: ResourceCompensationResult,
): StoredResourceCompensationResult {
  if (result.status === 'completed') {
    return { status: 'completed', receipt: storedReceipt(result.receipt) }
  }
  if (result.status === 'rejected') return { status: 'rejected', reason: result.reason }
  return { status: 'unavailable', reason: result.reason }
}

function resourceStructureCommand(
  command: Infer<typeof resourceStructureCommandValidator>,
): ResourceStructureCommand {
  const resourceId = (value: string) => assertDomainId(DOMAIN_ID_KIND.resource, value)
  switch (command.type) {
    case 'create':
      return {
        ...command,
        resourceId: resourceId(command.resourceId),
        parentId: command.parentId === null ? null : resourceId(command.parentId),
        title: canonicalizeResourceTitle(command.title),
      }
    case 'updateMetadata':
      return {
        ...command,
        resourceId: resourceId(command.resourceId),
        changes: {
          ...(command.changes.title === undefined
            ? {}
            : { title: canonicalizeResourceTitle(command.changes.title) }),
          ...(command.changes.icon === undefined ? {} : { icon: command.changes.icon }),
          ...(command.changes.color === undefined ? {} : { color: command.changes.color }),
        },
      }
    case 'move':
      return {
        type: 'move',
        resourceIds: command.resourceIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
      return { type: command.type, resourceIds: command.resourceIds.map(resourceId) }
    case 'deepCopy':
      return {
        type: 'deepCopy',
        sourceRootIds: command.sourceRootIds.map(resourceId),
        destinationParentId:
          command.destinationParentId === null ? null : resourceId(command.destinationParentId),
      }
  }
}

export const executeStructureCommand = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type === 'create' && command.kind !== 'folder') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    return storedResult(result)
  },
})

export const compensateResourceOperation = campaignMutation({
  args: {
    operationId: operationIdValidator,
    originalOperationId: operationIdValidator,
  },
  returns: resourceCompensationResultValidator,
  handler: async (ctx, args): Promise<StoredResourceCompensationResult> => {
    return storedCompensationResult(await compensateResourceOperationFn(ctx, args))
  },
})

export const executeBookmarkCommand = dmMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceBookmarkCommandValidator,
  },
  returns: resourceBookmarkCommandResultValidator,
  handler: async (ctx, args) => {
    const result = await executeBookmarkCommandFn(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      {
        type: args.command.type,
        resourceIds: args.command.resourceIds.map((resourceId) =>
          assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
        ),
        bookmarked: args.command.bookmarked,
      },
    )
    return result.status === 'completed'
      ? {
          status: 'completed' as const,
          receipt: { ...result.receipt, resourceIds: [...result.receipt.resourceIds] },
        }
      : result
  },
})

export const createNoteResource = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    update: v.bytes(),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type !== 'create' || command.kind !== 'note') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const version = await prepareNoteContentCreation(args.update)
    if (!version) return { status: 'rejected', reason: 'content_integrity_failure' }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    if (result.status !== 'completed') return storedResult(result)
    const contentResult = await createNoteContent(
      ctx,
      ctx.resourceScope.campaignId,
      command.resourceId,
      assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
      args.update,
      version,
    )
    if (contentResult === 'operation_id_reused') {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    await syncNoteSearchProjection(ctx, command.resourceId, args.update)
    return storedResult(result)
  },
})

export const createMapResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'map', createMapContent),
})

export const createCanvasResource = campaignMutation({
  args: { operationId: operationIdValidator, command: resourceStructureCommandValidator },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> =>
    await createFixedContentResource(ctx, args, 'canvas', createCanvasContent),
})

export const saveNoteContent = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    update: v.bytes(),
  },
  returns: saveNoteContentResultValidator,
  handler: async (ctx, args) =>
    await saveNoteContentFn(ctx, {
      resourceId: args.resourceId,
      update: args.update,
    }),
})

export const createFileResource = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    uploadSessionId: v.id('fileStorage'),
    metadata: v.object(fileOwnedMetadataValidators),
    version: versionStampValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const command = readStructureCommand(args.command)
    if ('status' in command) return command
    if (command.type !== 'create' || command.kind !== 'file') {
      return { status: 'rejected', reason: 'invalid_command' }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    if (result.status !== 'completed') return storedResult(result)

    const content = await ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', command.resourceId))
      .unique()
    if (content) {
      if (content.campaignUuid !== ctx.resourceScope.campaignId || content.assetUuid === null) {
        throw new TypeError('Created file content is inconsistent')
      }
      const version = assertVersionStamp(args.version)
      if (
        content.byteSize !== args.metadata.byteSize ||
        content.classification !== args.metadata.classification ||
        content.detectedFormat !== args.metadata.detectedFormat ||
        content.extension !== args.metadata.extension ||
        content.mediaType !== args.metadata.mediaType ||
        content.version.digest !== version.digest ||
        content.version.revision !== version.revision ||
        content.viewerUnavailableReason !== args.metadata.viewerUnavailableReason
      ) {
        return { status: 'rejected', reason: 'operation_id_reused' }
      }
      return storedResult(result)
    }

    const upload = await commitUpload(ctx, { sessionId: args.uploadSessionId })
    const version = assertVersionStamp(args.version)
    if (
      upload.assetId === null ||
      upload.metadata.size !== args.metadata.byteSize ||
      version.revision !== 1 ||
      (args.metadata.classification === FILE_CLASSIFICATION.inert) !==
        (args.metadata.viewerUnavailableReason !== null)
    ) {
      throw new TypeError('Uploaded file metadata is inconsistent')
    }
    await Promise.all([
      ctx.db.insert('resourceFileContents', {
        campaignUuid: ctx.resourceScope.campaignId,
        resourceUuid: command.resourceId,
        state: 'ready',
        assetUuid: upload.assetId,
        ...args.metadata,
        version,
      }),
      ctx.db.insert('resourceAssetOwners', {
        campaignUuid: ctx.resourceScope.campaignId,
        resourceUuid: command.resourceId,
        assetUuid: upload.assetId,
      }),
    ])
    return storedResult(result)
  },
})
