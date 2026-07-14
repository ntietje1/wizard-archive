import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceCommandReceipt,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
  ResourceStructureResult,
} from '@wizard-archive/editor/resources/command-contract'
import {
  normalizeResourceStructureCommand,
  resourceStructureInputRejection,
} from '@wizard-archive/editor/resources/command-protocol'

type ExecuteArgs = FunctionArgs<typeof api.resources.mutations.executeStructureCommand>
type ExecuteResult = FunctionReturnType<typeof api.resources.mutations.executeStructureCommand>

type LiveResourceStructureMutation = (args: ExecuteArgs) => Promise<ExecuteResult>

function toMutationCommand(
  command: ReturnType<typeof normalizeResourceStructureCommand>,
): ExecuteArgs['command'] {
  switch (command.type) {
    case 'move':
      return { ...command, resourceIds: [...command.resourceIds] }
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
      return { ...command, resourceIds: [...command.resourceIds] }
    case 'deepCopy':
      return { ...command, sourceRootIds: [...command.sourceRootIds] }
    case 'create':
    case 'updateMetadata':
      return command
  }
}

function readStructureResult(
  value: ResourceCommandReceiptShape['result'],
): ResourceStructureResult {
  switch (value.type) {
    case 'created':
    case 'metadataUpdated':
      return {
        type: value.type,
        resourceId: assertDomainId(DOMAIN_ID_KIND.resource, value.resourceId),
      }
    case 'moved':
    case 'trashed':
    case 'restored':
    case 'permanentlyDeleted':
      return {
        type: value.type,
        resourceIds: value.resourceIds.map((id) => assertDomainId(DOMAIN_ID_KIND.resource, id)),
      }
    case 'deepCopied':
      return {
        type: value.type,
        roots: value.roots.map((root) => ({
          sourceRootId: assertDomainId(DOMAIN_ID_KIND.resource, root.sourceRootId),
          destinationRootId: assertDomainId(DOMAIN_ID_KIND.resource, root.destinationRootId),
        })),
      }
  }
}

type ResourceCommandReceiptShape = Extract<ExecuteResult, { status: 'completed' }>['receipt']

function readReceipt(value: ResourceCommandReceiptShape): ResourceCommandReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, value.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, value.operationId),
    result: readStructureResult(value.result),
    postconditions: value.postconditions.map((postcondition) =>
      postcondition.state === 'missing'
        ? {
            state: postcondition.state,
            resourceId: assertDomainId(DOMAIN_ID_KIND.resource, postcondition.resourceId),
          }
        : {
            state: postcondition.state,
            resourceId: assertDomainId(DOMAIN_ID_KIND.resource, postcondition.resourceId),
            metadataVersion: assertVersionStamp(postcondition.metadataVersion),
          },
    ),
  }
}

function readResult(value: ExecuteResult): ResourceStructureCommandResult {
  if (value.status === 'completed')
    return { status: value.status, receipt: readReceipt(value.receipt) }
  return value
}

export function createLiveResourceStructureGateway(
  campaignId: CampaignId,
  executeMutation: LiveResourceStructureMutation,
): ResourceStructureCommandGateway {
  return {
    execute: async (envelope) => {
      if (envelope.campaignId !== campaignId) {
        return {
          status: 'received',
          result: { status: 'unavailable', reason: 'scope_unavailable' },
        }
      }

      let args: ExecuteArgs
      try {
        args = {
          campaignId,
          operationId: assertDomainId(DOMAIN_ID_KIND.operation, envelope.operationId),
          command: toMutationCommand(normalizeResourceStructureCommand(envelope.command)),
        }
      } catch (error) {
        return {
          status: 'received',
          result: { status: 'rejected', reason: resourceStructureInputRejection(error) },
        }
      }

      try {
        const result = readResult(await executeMutation(args))
        if (
          result.status === 'completed' &&
          (result.receipt.campaignId !== campaignId ||
            result.receipt.operationId !== envelope.operationId)
        ) {
          throw new TypeError('Resource command receipt does not match its envelope')
        }
        return { status: 'received', result }
      } catch {
        return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
      }
    },
  }
}
