import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type {
  CommandDelivery,
  ResourceAccessCommand,
  ResourceAccessCommandResult,
  ResourceAccessReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import { normalizeResourceAccessCommand } from '@wizard-archive/editor/resources/command-protocol'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceAccessGateway } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type {
  ResourceKnowledge,
  WorkspaceResourceIndex,
} from '@wizard-archive/editor/resources/index-contract'
import type { ResourceAccessPresentation } from '@wizard-archive/editor/resources/access-policy'

type ExecuteArgs = FunctionArgs<typeof api.resources.mutations.executeResourceAccessCommand>
type ExecuteResult = FunctionReturnType<typeof api.resources.mutations.executeResourceAccessCommand>
type ExecuteMutation = (args: ExecuteArgs) => Promise<ExecuteResult>
type WatchPresentation = (
  resourceId: ResourceId,
  apply: (value: ResourceAccessPresentation | null) => void,
) => () => void

type LiveResourceAccessGateway = ResourceAccessGateway & Readonly<{ dispose(): void }>
const UNKNOWN_PRESENTATION = { state: 'unknown' } as const

export function createLiveResourceAccessGateway(
  campaignId: CampaignId,
  index: WorkspaceResourceIndex,
  executeMutation: ExecuteMutation | null,
  watchPresentation: WatchPresentation | null = null,
): LiveResourceAccessGateway {
  const presentations = new Map<ResourceId, ResourceKnowledge<ResourceAccessPresentation>>()
  const watches = new Map<ResourceId, () => void>()
  const listeners = new Map<ResourceId, Set<() => void>>()
  const publish = (resourceId: ResourceId) => {
    for (const listener of listeners.get(resourceId) ?? []) listener()
  }
  return {
    get: (resourceId: ResourceId) => {
      const resource = index.getSnapshot().lookup(resourceId)
      return resource.state === 'known'
        ? { state: 'known', value: resource.value.permission }
        : resource
    },
    getPresentation: (resourceId) => {
      return presentations.get(resourceId) ?? UNKNOWN_PRESENTATION
    },
    loadPresentation: (resourceId) => {
      if (!watchPresentation || watches.has(resourceId)) return
      watches.set(
        resourceId,
        watchPresentation(resourceId, (presentation) => {
          presentations.set(
            resourceId,
            presentation === null ? { state: 'missing' } : { state: 'known', value: presentation },
          )
          publish(resourceId)
        }),
      )
    },
    subscribe: (resourceId, listener) => {
      const resourceListeners = listeners.get(resourceId) ?? new Set()
      resourceListeners.add(listener)
      listeners.set(resourceId, resourceListeners)
      const unsubscribeIndex = index.subscribe(listener)
      return () => {
        unsubscribeIndex()
        resourceListeners.delete(listener)
        if (resourceListeners.size === 0) listeners.delete(resourceId)
      }
    },
    execute: async (envelope) => {
      if (envelope.campaignId !== campaignId) return scopeUnavailable()
      if (!executeMutation) return unauthorized()
      let command: ResourceAccessCommand
      try {
        command = normalizeResourceAccessCommand(envelope.command)
      } catch (error) {
        return {
          status: 'received',
          result: {
            status: 'rejected',
            reason:
              error instanceof Error && error.message.includes('permission')
                ? 'invalid_permission'
                : 'invalid_command',
          },
        }
      }
      try {
        const value = await executeMutation({
          campaignId,
          operationId: envelope.operationId,
          command: mutationCommand(command),
        })
        const result = readResult(value)
        if (
          result.status === 'completed' &&
          (result.receipt.campaignId !== campaignId ||
            result.receipt.operationId !== envelope.operationId)
        ) {
          throw new TypeError('Resource access receipt does not match its envelope')
        }
        return { status: 'received', result }
      } catch {
        return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
      }
    },
    dispose: () => {
      for (const dispose of watches.values()) dispose()
      watches.clear()
      listeners.clear()
      presentations.clear()
    },
  }
}

function mutationCommand(command: ResourceAccessCommand): ExecuteArgs['command'] {
  return command.type === 'setFolderAccessInheritance'
    ? command
    : { ...command, resourceIds: [...command.resourceIds] }
}

function readResult(value: ExecuteResult): ResourceAccessCommandResult {
  if (value.status !== 'completed') return value
  return {
    status: 'completed',
    receipt: readReceipt(value.receipt),
  }
}

function readReceipt(
  value: Extract<ExecuteResult, { status: 'completed' }>['receipt'],
): ResourceAccessReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, value.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, value.operationId),
    resourceIds: value.resourceIds.map((resourceId) =>
      assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
    ),
  }
}

function unauthorized(): CommandDelivery<ResourceAccessCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'unauthorized' },
  }
}

function scopeUnavailable(): CommandDelivery<ResourceAccessCommandResult> {
  return {
    status: 'received',
    result: { status: 'unavailable', reason: 'scope_unavailable' },
  }
}
