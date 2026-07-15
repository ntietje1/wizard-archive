import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type {
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import {
  normalizeResourcePostconditions,
  resourceStructureInputRejection,
} from '@wizard-archive/editor/resources/command-protocol'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { FILE_CLASSIFICATION } from '@wizard-archive/editor/resources/file-content-contract'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { campaignMutation, dmMutation } from '../functions'
import {
  executeStructureCommand as executeStructureCommandFn,
  executeStructureCompensation as executeStructureCompensationFn,
} from './functions/executeStructureCommand'
import {
  bindNoteContentResultValidator,
  fileOwnedMetadataValidators,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
  resourcePostconditionValidator,
  resourceBookmarkCommandResultValidator,
  resourceBookmarkCommandValidator,
  versionStampValidator,
} from './schema'
import { bindNoteContent as bindNoteContentFn } from './functions/bindNoteContent'
import { operationIdValidator, resourceIdValidator } from './validators'
import { executeBookmarkCommand as executeBookmarkCommandFn } from './functions/executeBookmarkCommand'
import { commitUpload } from '../storage/functions/commitUpload'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>
type StoredResourceCommandReceipt = Extract<
  StoredResourceStructureCommandResult,
  { status: 'completed' }
>['receipt']

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
    let command: ResourceStructureCommand
    try {
      command = resourceStructureCommand(args.command)
    } catch (error) {
      return { status: 'rejected', reason: resourceStructureInputRejection(error) }
    }
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command,
    })
    return storedResult(result)
  },
})

export const executeStructureCompensation = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
    expectedPostconditions: v.array(resourcePostconditionValidator),
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    let command: ResourceStructureCommand
    let expectedPostconditions
    try {
      command = resourceStructureCommand(args.command)
      expectedPostconditions = normalizeResourcePostconditions(args.expectedPostconditions)
    } catch (error) {
      return { status: 'rejected', reason: resourceStructureInputRejection(error) }
    }
    return storedResult(
      await executeStructureCompensationFn(ctx, {
        operationId: args.operationId,
        command,
        expectedPostconditions,
      }),
    )
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
      args.command.resourceIds.map((resourceId) =>
        assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
      ),
      args.command.bookmarked,
    )
    return result.status === 'completed'
      ? {
          status: 'completed' as const,
          receipt: { ...result.receipt, resourceIds: [...result.receipt.resourceIds] },
        }
      : result
  },
})

export const bindNoteContent = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    operationId: operationIdValidator,
    update: v.bytes(),
  },
  returns: bindNoteContentResultValidator,
  handler: async (ctx, args) =>
    await bindNoteContentFn(ctx, {
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId),
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, args.operationId),
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
    let command: ResourceStructureCommand
    try {
      command = resourceStructureCommand(args.command)
    } catch (error) {
      return { status: 'rejected', reason: resourceStructureInputRejection(error) }
    }
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
    if (!content || content.campaignUuid !== ctx.resourceScope.campaignId) {
      throw new TypeError('Created file content is missing')
    }
    if (content.assetUuid !== null) return storedResult(result)

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
      ctx.db.patch('resourceFileContents', content._id, {
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
