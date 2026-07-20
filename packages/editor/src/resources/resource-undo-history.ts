import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { CampaignId, OperationId } from './domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourceCompensationResult,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
  ResourceCompensationGateway,
} from './resource-command-contract'

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
  undo(): Promise<CommandDelivery<ResourceCompensationResult>>
  redo(): Promise<CommandDelivery<ResourceCompensationResult>>
}

export interface ResourceUndoRecording {
  completed(receipt: ResourceCommandReceipt): void
  abandon(): void
}

type HistoryEntry = Readonly<{ operationId: OperationId; label: string }>

const EMPTY_DELIVERY: CommandDelivery<ResourceCompensationResult> = {
  status: 'received',
  result: { status: 'unavailable', reason: 'dependency_unavailable' },
}
const MAX_HISTORY_ENTRIES = 100

function receiptHistoryLabel(receipt: ResourceCommandReceipt): string {
  switch (receipt.result.type) {
    case 'created':
      return 'create resource'
    case 'metadataUpdated':
      return 'edit resource'
    case 'moved':
      return receipt.result.resourceIds.length === 1 ? 'move' : 'move resources'
    case 'trashed':
      return receipt.result.resourceIds.length === 1 ? 'move to Trash' : 'move resources to Trash'
    case 'restored':
      return receipt.result.resourceIds.length === 1 ? 'restore' : 'restore resources'
    case 'deepCopied':
      return receipt.result.roots.length === 1 ? 'duplicate' : 'duplicate resources'
    case 'permanentlyDeleted':
      return 'permanently delete'
  }
}

function commandHistoryLabel(command: ResourceStructureCommand): string {
  switch (command.type) {
    case 'create':
      return `create ${command.kind}`
    case 'updateMetadata':
      return metadataHistoryLabel(command.changes)
    case 'move':
      return singleOrPlural(
        command.resourceIds.length,
        'move',
        `move ${command.resourceIds.length} resources`,
      )
    case 'trash':
      return singleOrPlural(
        command.resourceIds.length,
        'move to Trash',
        `move ${command.resourceIds.length} resources to Trash`,
      )
    case 'restore':
      return singleOrPlural(
        command.resourceIds.length,
        'restore',
        `restore ${command.resourceIds.length} resources`,
      )
    case 'deepCopy':
      return singleOrPlural(
        command.sourceRootIds.length,
        'duplicate',
        `duplicate ${command.sourceRootIds.length} resources`,
      )
    case 'permanentlyDelete':
      return 'permanently delete'
  }
}

function metadataHistoryLabel(
  changes: Extract<ResourceStructureCommand, { type: 'updateMetadata' }>['changes'],
): string {
  const signature = (['title', 'icon', 'color'] as const)
    .filter((field) => changes[field] !== undefined)
    .join('+')
  switch (signature) {
    case 'title':
      return 'rename'
    case 'icon':
      return 'change icon'
    case 'color':
      return 'change color'
    case 'icon+color':
      return 'change icon and color'
    default:
      return 'edit resource'
  }
}

function singleOrPlural(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function createResourceUndoHistory(
  campaignId: CampaignId,
  structure: ResourceStructureCommandGateway,
  compensation: ResourceCompensationGateway,
) {
  const listeners = new Set<() => void>()
  const undoStack: Array<HistoryEntry> = []
  const redoStack: Array<HistoryEntry> = []
  let pendingRequest: Readonly<{
    originalOperationId: OperationId
    operationId: OperationId
  }> | null = null
  let snapshot: ResourceUndoHistorySnapshot = { status: 'ready', undo: null, redo: null }

  const publish = () => {
    if (snapshot.status !== 'running') {
      const undo = undoStack.at(-1)
      const redo = redoStack.at(-1)
      snapshot = {
        status: 'ready',
        undo: undo ? { label: undo.label } : null,
        redo: redo ? { label: redo.label } : null,
      }
    }
    for (const listener of listeners) listener()
  }

  const recordCompleted = (receipt: ResourceCommandReceipt, label?: string) => {
    if (
      undoStack.some((entry) => entry.operationId === receipt.operationId) ||
      redoStack.some((entry) => entry.operationId === receipt.operationId)
    ) {
      return
    }
    redoStack.length = 0
    if (receipt.result.type === 'permanentlyDeleted') {
      undoStack.length = 0
    } else {
      undoStack.push({
        operationId: receipt.operationId,
        label: label ?? receiptHistoryLabel(receipt),
      })
      if (undoStack.length > MAX_HISTORY_ENTRIES) undoStack.shift()
    }
    publish()
  }

  const execute = async (direction: 'undo' | 'redo') => {
    if (snapshot.status === 'running') return EMPTY_DELIVERY
    const source = direction === 'undo' ? undoStack : redoStack
    const destination = direction === 'undo' ? redoStack : undoStack
    const entry = source.at(-1)
    if (!entry) return EMPTY_DELIVERY
    snapshot = { status: 'running', direction, label: entry.label }
    publish()
    const operationId =
      pendingRequest?.originalOperationId === entry.operationId
        ? pendingRequest.operationId
        : generateDomainId(DOMAIN_ID_KIND.operation)
    pendingRequest = { originalOperationId: entry.operationId, operationId }
    const delivery = await compensation.compensate({
      campaignId,
      operationId,
      originalOperationId: entry.operationId,
    })
    if (delivery.status === 'received') {
      pendingRequest = null
      if (delivery.result.status === 'completed') {
        source.pop()
        destination.push({ operationId: delivery.result.receipt.operationId, label: entry.label })
        if (destination.length > MAX_HISTORY_ENTRIES) destination.shift()
      } else if (delivery.result.status === 'rejected') {
        undoStack.length = 0
        redoStack.length = 0
      }
    } else if (delivery.status === 'not_committed') {
      pendingRequest = null
    }
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
  const beginRecording = (label?: string) => {
    let active = true
    return {
      abandon: () => {
        active = false
      },
      completed: (receipt: ResourceCommandReceipt) => {
        if (!active) return
        active = false
        recordCompleted(receipt, label)
      },
    } satisfies ResourceUndoRecording
  }
  return {
    beginRecording,
    history,
    structure: {
      execute: async (envelope: CommandEnvelope<ResourceStructureCommand>) => {
        const undoRecording = beginRecording(commandHistoryLabel(envelope.command))
        const delivery = await structure.execute(envelope)
        if (delivery.status === 'received' && delivery.result.status === 'completed') {
          undoRecording.completed(delivery.result.receipt)
        } else if (delivery.status !== 'indeterminate') {
          undoRecording.abandon()
        }
        return delivery
      },
    } satisfies ResourceStructureCommandGateway,
  }
}
