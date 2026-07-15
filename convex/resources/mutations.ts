import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type {
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { resourceStructureInputRejection } from '@wizard-archive/editor/resources/command-protocol'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { campaignMutation } from '../functions'
import { executeStructureCommand as executeStructureCommandFn } from './functions/executeStructureCommand'
import {
  bindNoteContentResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
} from './schema'
import { bindNoteContent as bindNoteContentFn } from './functions/bindNoteContent'
import { operationIdValidator, resourceIdValidator } from './validators'

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
