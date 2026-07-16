import type {
  CommandEnvelope,
  CommandDelivery,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { WorkspaceResourceIndex } from './resource-index-contract'
import type { OptimisticResourceCommand } from './resource-optimism-contract'
import { OptimisticWorkspaceResourceIndex } from './resource-optimistic-index'
import type { ResourceOptimisticSubmitResult } from './resource-optimistic-index'

function isOptimisticCommand(
  command: ResourceStructureCommand,
): command is OptimisticResourceCommand {
  return command.type !== 'deepCopy' && command.type !== 'permanentlyDelete'
}

function rejectedSubmission(
  submission: Extract<ResourceOptimisticSubmitResult, { status: 'rejected' }>,
): CommandDelivery<ResourceStructureCommandResult> {
  switch (submission.reason) {
    case 'dependency_unavailable':
      return {
        status: 'received',
        result: { status: 'unavailable', reason: 'dependency_unavailable' },
      }
    case 'scope_changed':
      return {
        status: 'received',
        result: { status: 'unavailable', reason: 'scope_unavailable' },
      }
    case 'operation_id_reused':
      return {
        status: 'received',
        result: { status: 'rejected', reason: 'operation_id_reused' },
      }
    case 'invalid_command':
      return {
        status: 'received',
        result: { status: 'rejected', reason: 'invalid_command' },
      }
  }
}

function createOptimisticStructureGateway(
  index: OptimisticWorkspaceResourceIndex,
  authoritative: ResourceStructureCommandGateway,
  observer?: ResourceOptimisticObserver,
): ResourceStructureCommandGateway {
  return {
    execute: async (envelope) => {
      const command = envelope.command
      if (!isOptimisticCommand(command)) {
        return await authoritative.execute(envelope)
      }

      const submission = await index.submit(envelope.operationId, command)
      if (submission.status === 'rejected') return rejectedSubmission(submission)
      observer?.applied({ ...envelope, command })

      const delivery = await authoritative.execute(envelope)
      index.reconcile(envelope.operationId, delivery)
      return delivery
    },
  }
}

interface ResourceOptimisticObserver {
  applied(envelope: CommandEnvelope<OptimisticResourceCommand>): void
}

type OptimisticResourceStructureRuntime = Readonly<{
  dispose: () => void
  index: WorkspaceResourceIndex
  structure: ResourceStructureCommandGateway
}>

export function createOptimisticResourceStructureRuntime(
  baseIndex: WorkspaceResourceIndex,
  authoritativeGateway: ResourceStructureCommandGateway,
  now: () => number = Date.now,
  observer?: ResourceOptimisticObserver,
): OptimisticResourceStructureRuntime {
  const index = new OptimisticWorkspaceResourceIndex(baseIndex, now)
  const projectedIndex: WorkspaceResourceIndex = {
    getSnapshot: () => index.snapshot(),
    subscribe: (listener) => index.onChange(listener),
  }
  return {
    dispose: () => index.dispose(),
    index: projectedIndex,
    structure: createOptimisticStructureGateway(index, authoritativeGateway, observer),
  }
}
