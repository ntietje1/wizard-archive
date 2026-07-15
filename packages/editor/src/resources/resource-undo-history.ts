import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
  ResourceStructureCompensationGateway,
} from './resource-command-contract'
import type {
  AuthorizedResourceSummary,
  WorkspaceResourceIndex,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'

export type ResourceUndoHistorySnapshot =
  | Readonly<{
      status: 'ready'
      undo: Readonly<{ label: string }> | null
      redo: Readonly<{ label: string }> | null
    }>
  | Readonly<{ status: 'running'; direction: 'undo' | 'redo'; label: string }>

export interface ResourceUndoHistory {
  getSnapshot(): ResourceUndoHistorySnapshot
  subscribe(listener: () => void): () => void
  undo(): Promise<CommandDelivery<ResourceStructureCommandResult>>
  redo(): Promise<CommandDelivery<ResourceStructureCommandResult>>
}

export interface ResourceHistoryRecording {
  completed(receipt: ResourceCommandReceipt): void
  abandon(): void
}

type HistoryEntry = {
  label: string
  undoCommand: ResourceStructureCommand
  redoCommand: ResourceStructureCommand
  undoExpected: ReadonlyArray<ResourcePostcondition>
  redoExpected: ReadonlyArray<ResourcePostcondition>
  undoDependencyConditions: ReadonlyArray<ResourcePostcondition>
  redoDependencyConditions: ReadonlyArray<ResourcePostcondition>
  undoOperationId?: CommandEnvelope<ResourceStructureCommand>['operationId']
  redoOperationId?: CommandEnvelope<ResourceStructureCommand>['operationId']
}

type HistoryPlan = Pick<HistoryEntry, 'label' | 'redoCommand' | 'undoCommand'> &
  Readonly<{
    undoDependencyIds: ReadonlyArray<ResourceId | null>
    redoDependencyIds: ReadonlyArray<ResourceId | null>
  }>

type PendingHistoryAction = Readonly<{
  command: ResourceStructureCommand
  expected: ReadonlyArray<ResourcePostcondition>
  operationId: CommandEnvelope<ResourceStructureCommand>['operationId'] | undefined
  remember(operationId: CommandEnvelope<ResourceStructureCommand>['operationId'] | undefined): void
  complete(receipt: ResourceCommandReceipt): void
}>

const EMPTY_DELIVERY: CommandDelivery<ResourceStructureCommandResult> = {
  status: 'received',
  result: { status: 'unavailable', reason: 'dependency_unavailable' },
}
const MAX_HISTORY_ENTRIES = 100

function selectedIds(command: ResourceStructureCommand): ReadonlyArray<ResourceId> {
  switch (command.type) {
    case 'create':
    case 'updateMetadata':
      return [command.resourceId]
    case 'move':
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
      return command.resourceIds
    case 'deepCopy':
      return command.sourceRootIds
  }
}

function knownResources(
  snapshot: WorkspaceResourceIndexSnapshot,
  ids: ReadonlyArray<ResourceId>,
): ReadonlyArray<AuthorizedResourceSummary> | null {
  const resources: Array<AuthorizedResourceSummary> = []
  for (const id of ids) {
    const knowledge = snapshot.lookup(id)
    if (knowledge.state !== 'known') return null
    resources.push(knowledge.value)
  }
  return resources
}

function dependencyConditions(
  snapshot: WorkspaceResourceIndexSnapshot,
  ids: ReadonlyArray<ResourceId | null>,
): ReadonlyArray<ResourcePostcondition> | null {
  const dependencies: Array<ResourcePostcondition> = []
  for (const id of new Set(ids)) {
    if (id === null) continue
    const knowledge = snapshot.lookup(id)
    if (knowledge.state !== 'known') return null
    dependencies.push({
      state: 'present',
      resourceId: id,
      metadataVersion: knowledge.value.metadataVersion,
    })
  }
  return dependencies
}

function mergeExpected(
  receipt: ResourceCommandReceipt,
  dependencies: ReadonlyArray<ResourcePostcondition>,
): ReadonlyArray<ResourcePostcondition> {
  const conditions = new Map<ResourceId, ResourcePostcondition>()
  for (const condition of dependencies) conditions.set(condition.resourceId, condition)
  for (const condition of receipt.postconditions) conditions.set(condition.resourceId, condition)
  return Array.from(conditions.values())
}

function resourceLabel(resources: ReadonlyArray<AuthorizedResourceSummary>): string {
  return resources.length === 1
    ? (resources[0]?.title ?? 'resource')
    : `${resources.length} resources`
}

function createPlan(command: Extract<ResourceStructureCommand, { type: 'create' }>): HistoryPlan {
  return {
    label: `Create ${command.title}`,
    undoCommand: { type: 'trash', resourceIds: [command.resourceId] },
    redoCommand: { type: 'restore', resourceIds: [command.resourceId] },
    undoDependencyIds: [],
    redoDependencyIds: [command.parentId],
  }
}

function metadataPlan(
  command: Extract<ResourceStructureCommand, { type: 'updateMetadata' }>,
  previous: AuthorizedResourceSummary | undefined,
): HistoryPlan | null {
  if (!previous) return null
  return {
    label: `Edit ${previous.title}`,
    undoCommand: {
      type: 'updateMetadata',
      resourceId: command.resourceId,
      changes: {
        ...(command.changes.title === undefined ? {} : { title: previous.title }),
        ...(command.changes.icon === undefined ? {} : { icon: previous.icon }),
        ...(command.changes.color === undefined ? {} : { color: previous.color }),
      },
    },
    redoCommand: command,
    undoDependencyIds: [],
    redoDependencyIds: [],
  }
}

function movePlan(
  command: Extract<ResourceStructureCommand, { type: 'move' }>,
  resources: ReadonlyArray<AuthorizedResourceSummary>,
): HistoryPlan | null {
  const originalParentIds = new Set(resources.map((resource) => resource.displayParentId))
  const originalParentId = resources[0]?.displayParentId
  if (originalParentIds.size !== 1 || originalParentId === undefined) return null
  return {
    label: `Move ${resourceLabel(resources)}`,
    undoCommand: {
      type: 'move',
      resourceIds: command.resourceIds,
      destinationParentId: originalParentId,
    },
    redoCommand: command,
    undoDependencyIds: [originalParentId],
    redoDependencyIds: [command.destinationParentId],
  }
}

function trashPlan(
  command: Extract<ResourceStructureCommand, { type: 'trash' }>,
  resources: ReadonlyArray<AuthorizedResourceSummary>,
): HistoryPlan {
  return {
    label: `Trash ${resourceLabel(resources)}`,
    undoCommand: { type: 'restore', resourceIds: command.resourceIds },
    redoCommand: command,
    undoDependencyIds: resources.map((resource) => resource.displayParentId),
    redoDependencyIds: [],
  }
}

function deepCopyPlan(
  command: Extract<ResourceStructureCommand, { type: 'deepCopy' }>,
  resources: ReadonlyArray<AuthorizedResourceSummary>,
  receipt: ResourceCommandReceipt,
): HistoryPlan | null {
  if (receipt.result.type !== 'deepCopied') return null
  const copiedIds = receipt.result.roots.map((root) => root.destinationRootId)
  return {
    label: `Duplicate ${resourceLabel(resources)}`,
    undoCommand: { type: 'trash', resourceIds: copiedIds },
    redoCommand: { type: 'restore', resourceIds: copiedIds },
    undoDependencyIds: [],
    redoDependencyIds: [command.destinationParentId],
  }
}

function historyPlan(
  command: ResourceStructureCommand,
  resources: ReadonlyArray<AuthorizedResourceSummary>,
  receipt: ResourceCommandReceipt,
): HistoryPlan | null {
  switch (command.type) {
    case 'create':
      return createPlan(command)
    case 'updateMetadata':
      return metadataPlan(command, resources[0])
    case 'move':
      return movePlan(command, resources)
    case 'trash':
      return trashPlan(command, resources)
    case 'deepCopy':
      return deepCopyPlan(command, resources, receipt)
    case 'restore':
    case 'permanentlyDelete':
      return null
  }
}

function planHistoryEntry(
  envelope: CommandEnvelope<ResourceStructureCommand>,
  before: WorkspaceResourceIndexSnapshot,
  receipt: ResourceCommandReceipt,
): HistoryEntry | null {
  const resources = knownResources(before, selectedIds(envelope.command))
  if (envelope.command.type !== 'create' && !resources) return null
  const plan = historyPlan(envelope.command, resources ?? [], receipt)
  if (!plan) return null
  const undoDependencyConditions = dependencyConditions(before, plan.undoDependencyIds)
  const redoDependencyConditions = dependencyConditions(before, plan.redoDependencyIds)
  if (!undoDependencyConditions || !redoDependencyConditions) return null
  return {
    label: plan.label,
    undoCommand: plan.undoCommand,
    redoCommand: plan.redoCommand,
    undoExpected: mergeExpected(receipt, undoDependencyConditions),
    redoExpected: [],
    undoDependencyConditions,
    redoDependencyConditions,
  }
}

function pendingHistoryAction(
  direction: 'undo' | 'redo',
  entry: HistoryEntry,
  undoStack: Array<HistoryEntry>,
  redoStack: Array<HistoryEntry>,
): PendingHistoryAction {
  if (direction === 'undo') {
    return {
      command: entry.undoCommand,
      expected: entry.undoExpected,
      operationId: entry.undoOperationId,
      remember: (operationId) => {
        entry.undoOperationId = operationId
      },
      complete: (receipt) => {
        undoStack.pop()
        entry.redoExpected = mergeExpected(receipt, entry.redoDependencyConditions)
        redoStack.push(entry)
      },
    }
  }
  return {
    command: entry.redoCommand,
    expected: entry.redoExpected,
    operationId: entry.redoOperationId,
    remember: (operationId) => {
      entry.redoOperationId = operationId
    },
    complete: (receipt) => {
      redoStack.pop()
      entry.undoExpected = mergeExpected(receipt, entry.undoDependencyConditions)
      undoStack.push(entry)
    },
  }
}

function settleHistoryAction(
  action: PendingHistoryAction,
  delivery: CommandDelivery<ResourceStructureCommandResult>,
): void {
  if (delivery.status === 'received') {
    action.remember(undefined)
    if (delivery.result.status === 'completed') action.complete(delivery.result.receipt)
  } else if (delivery.status === 'not_committed') {
    action.remember(undefined)
  }
}

export function createResourceUndoHistory(
  index: WorkspaceResourceIndex,
  structure: ResourceStructureCommandGateway,
  compensation: ResourceStructureCompensationGateway,
) {
  const listeners = new Set<() => void>()
  const undoStack: Array<HistoryEntry> = []
  const redoStack: Array<HistoryEntry> = []
  const recordedOperationIds = new Set<string>()
  const pendingBefore = new Map<string, WorkspaceResourceIndexSnapshot>()
  let snapshot: ResourceUndoHistorySnapshot = { status: 'ready', undo: null, redo: null }

  const publish = () => {
    if (snapshot.status !== 'running') {
      const undoEntry = undoStack.at(-1)
      const redoEntry = redoStack.at(-1)
      snapshot = {
        status: 'ready',
        undo: undoEntry ? { label: undoEntry.label } : null,
        redo: redoEntry ? { label: redoEntry.label } : null,
      }
    }
    for (const listener of listeners) listener()
  }

  const recordCompleted = (
    envelope: CommandEnvelope<ResourceStructureCommand>,
    before: WorkspaceResourceIndexSnapshot,
    receipt: ResourceCommandReceipt,
  ) => {
    if (recordedOperationIds.has(envelope.operationId)) return
    recordedOperationIds.add(envelope.operationId)
    redoStack.length = 0
    if (envelope.command.type === 'permanentlyDelete') undoStack.length = 0
    else {
      const entry = planHistoryEntry(envelope, before, receipt)
      if (entry) {
        undoStack.push(entry)
        if (undoStack.length > MAX_HISTORY_ENTRIES) undoStack.shift()
      }
    }
    publish()
  }

  const execute = async (direction: 'undo' | 'redo') => {
    if (snapshot.status === 'running') return EMPTY_DELIVERY
    const source = direction === 'undo' ? undoStack : redoStack
    const entry = source.at(-1)
    if (!entry) return EMPTY_DELIVERY
    snapshot = { status: 'running', direction, label: entry.label }
    publish()
    const action = pendingHistoryAction(direction, entry, undoStack, redoStack)
    const operationId = action.operationId ?? generateDomainId(DOMAIN_ID_KIND.operation)
    action.remember(operationId)
    const delivery = await compensation.executeCompensation({
      campaignId: index.getSnapshot().scope.campaignId,
      operationId,
      command: action.command,
      expectedPostconditions: action.expected,
    })
    settleHistoryAction(action, delivery)
    snapshot = { status: 'ready', undo: null, redo: null }
    publish()
    return delivery
  }

  const history: ResourceUndoHistory = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    undo: () => execute('undo'),
    redo: () => execute('redo'),
  }
  const begin = (envelope: CommandEnvelope<ResourceStructureCommand>) => {
    const before = pendingBefore.get(envelope.operationId) ?? index.getSnapshot()
    pendingBefore.set(envelope.operationId, before)
    const finish = () => pendingBefore.delete(envelope.operationId)
    return {
      abandon: finish,
      completed: (receipt: ResourceCommandReceipt) => {
        recordCompleted(envelope, before, receipt)
        finish()
      },
    } satisfies ResourceHistoryRecording
  }
  return {
    begin,
    history,
    recordCompleted,
    structure: {
      execute: async (envelope: CommandEnvelope<ResourceStructureCommand>) => {
        const complete = begin(envelope)
        const delivery = await structure.execute(envelope)
        if (delivery.status === 'received' && delivery.result.status === 'completed') {
          complete.completed(delivery.result.receipt)
        } else if (delivery.status !== 'indeterminate') {
          complete.abandon()
        }
        return delivery
      },
    } satisfies ResourceStructureCommandGateway,
  }
}
