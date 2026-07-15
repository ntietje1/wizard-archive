import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CommandDelivery,
  ResourceCommandReceipt,
  ResourceStructureCommandGateway,
  ResourceStructureCompensationGateway,
  ResourceStructureCommandResult,
  ResourceStructureResult,
} from '@wizard-archive/editor/resources/command-contract'
import {
  normalizeResourceStructureCommand,
  normalizeResourcePostconditions,
  resourceStructureInputRejection,
} from '@wizard-archive/editor/resources/command-protocol'

type ExecuteArgs = FunctionArgs<typeof api.resources.mutations.executeStructureCommand>
type ExecuteResult = FunctionReturnType<typeof api.resources.mutations.executeStructureCommand>
type ExecuteCompensationArgs = FunctionArgs<
  typeof api.resources.mutations.executeStructureCompensation
>

type LiveResourceStructureMutation = (args: ExecuteArgs) => Promise<ExecuteResult>
type LiveResourceCompensationMutation = (args: ExecuteCompensationArgs) => Promise<ExecuteResult>

export function toLiveStructureMutationCommand(
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

export function readLiveStructureResult(value: ExecuteResult): ResourceStructureCommandResult {
  if (value.status === 'completed')
    return { status: value.status, receipt: readReceipt(value.receipt) }
  return value
}

function scopeUnavailable(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'unavailable', reason: 'scope_unavailable' },
  }
}

function invalidInput(error: unknown): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: resourceStructureInputRejection(error) },
  }
}

async function deliver(
  campaignId: CampaignId,
  operationId: ExecuteArgs['operationId'],
  mutate: () => Promise<ExecuteResult>,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  try {
    const result = readLiveStructureResult(await mutate())
    if (
      result.status === 'completed' &&
      (result.receipt.campaignId !== campaignId || result.receipt.operationId !== operationId)
    ) {
      throw new TypeError('Resource command receipt does not match its envelope')
    }
    return { status: 'received', result }
  } catch {
    return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
  }
}

function executeArgs(
  campaignId: CampaignId,
  envelope: Parameters<ResourceStructureCommandGateway['execute']>[0],
): ExecuteArgs {
  return {
    campaignId,
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, envelope.operationId),
    command: toLiveStructureMutationCommand(normalizeResourceStructureCommand(envelope.command)),
  }
}

export function createLiveResourceStructureGateway(
  campaignId: CampaignId,
  executeMutation: LiveResourceStructureMutation,
): ResourceStructureCommandGateway {
  return {
    execute: async (envelope) => {
      if (envelope.campaignId !== campaignId) {
        return scopeUnavailable()
      }

      let args: ExecuteArgs
      try {
        args = executeArgs(campaignId, envelope)
      } catch (error) {
        return invalidInput(error)
      }
      return await deliver(campaignId, args.operationId, () => executeMutation(args))
    },
  }
}

export function createLiveResourceCompensationGateway(
  campaignId: CampaignId,
  executeMutation: LiveResourceCompensationMutation,
): ResourceStructureCompensationGateway {
  return {
    executeCompensation: async (envelope) => {
      if (envelope.campaignId !== campaignId) {
        return scopeUnavailable()
      }
      let args: ExecuteCompensationArgs
      try {
        args = {
          ...executeArgs(campaignId, envelope),
          expectedPostconditions: normalizeResourcePostconditions(
            envelope.expectedPostconditions,
          ).map((condition) =>
            condition.state === 'missing'
              ? condition
              : {
                  ...condition,
                  metadataVersion: { ...condition.metadataVersion },
                },
          ),
        }
      } catch (error) {
        return invalidInput(error)
      }
      return await deliver(campaignId, args.operationId, () => executeMutation(args))
    },
  }
}
