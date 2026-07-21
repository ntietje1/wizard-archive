import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type {
  CommandDelivery,
  ResourceAccessCommand,
  ResourceAccessCommandResult,
  ResourceAccessReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import {
  accessCommandInputRejection,
  normalizeResourceAccessCommand,
} from '@wizard-archive/editor/resources/command-protocol'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceAccess,
  ResourceAccessSource,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { WorkspaceResourceIndex } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceAccessPresentation } from '@wizard-archive/editor/resources/access-policy'
import { createLivePaginatedPresentationStore } from './live-paginated-presentation-store'

type ExecuteArgs = FunctionArgs<typeof api.resources.mutations.executeResourceAccessCommand>
type ExecuteResult = FunctionReturnType<typeof api.resources.mutations.executeResourceAccessCommand>
type ExecuteMutation = (args: ExecuteArgs) => Promise<ExecuteResult>
type WatchPresentation = (
  resourceId: ResourceId,
  cursor: string | null,
  apply: (value: FunctionReturnType<typeof api.resources.queries.loadResourceAccess>) => void,
) => () => void
type ResourceAccessPresentationPage = NonNullable<
  FunctionReturnType<typeof api.resources.queries.loadResourceAccess>['presentation']
>

type LiveResourceAccess = ResourceAccess & Readonly<{ dispose(): void }>

type LiveResourceAccessInput =
  | Readonly<{ mode: 'readonly' }>
  | Readonly<{
      mode: 'editable'
      campaignId: CampaignId
      execute: ExecuteMutation
      watchPresentation: WatchPresentation
    }>

export function createLiveResourceAccess(
  index: WorkspaceResourceIndex,
  input: LiveResourceAccessInput,
): LiveResourceAccess {
  const source: ResourceAccessSource = {
    get: (resourceId) => {
      const resource = index.getSnapshot().lookup(resourceId)
      return resource.state === 'known'
        ? { state: 'known', value: resource.value.permission }
        : resource
    },
    subscribe: (listener) => index.subscribe(listener),
  }
  if (input.mode === 'readonly') {
    return { mode: 'readonly', source, dispose: () => undefined }
  }
  const presentations = createLivePaginatedPresentationStore<
    ResourceId,
    ResourceAccessPresentationPage,
    ResourceAccessPresentation
  >(input.watchPresentation, (pages, participantsComplete): ResourceAccessPresentation => {
    const first = pages[0]
    if (!first) throw new TypeError('Resource access page is unavailable')
    return {
      ...first,
      participants: pages.flatMap((page) => page.participants),
      participantsComplete,
    }
  })
  return {
    mode: 'editable',
    source,
    presentation: {
      get: presentations.get,
      loadMore: presentations.loadMore,
      subscribe: presentations.subscribe,
    },
    commands: {
      execute: async (envelope) => {
        if (envelope.campaignId !== input.campaignId) return scopeUnavailable()
        let command: ResourceAccessCommand
        try {
          command = normalizeResourceAccessCommand(envelope.command)
        } catch (error) {
          return {
            status: 'received',
            result: {
              status: 'rejected',
              reason: accessCommandInputRejection(error),
            },
          }
        }
        try {
          const value = await input.execute({
            campaignId: input.campaignId,
            operationId: envelope.operationId,
            command: mutationCommand(command),
          })
          const result = readResult(value)
          if (
            result.status === 'completed' &&
            (result.receipt.campaignId !== input.campaignId ||
              result.receipt.operationId !== envelope.operationId)
          ) {
            throw new TypeError('Resource access receipt does not match its envelope')
          }
          return { status: 'received', result }
        } catch {
          return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
        }
      },
    },
    dispose: presentations.dispose,
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

function scopeUnavailable(): CommandDelivery<ResourceAccessCommandResult> {
  return {
    status: 'received',
    result: { status: 'unavailable', reason: 'scope_unavailable' },
  }
}
