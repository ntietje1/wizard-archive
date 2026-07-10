import type {
  CanvasDocumentCommand,
  CanvasDocumentCommandResult,
  CanvasDocumentCommandType,
  CanvasDocumentWriter,
} from '../../tools/canvas-tool-types'
import { getNextCanvasElementZIndex } from './canvas-z-index'
import {
  createCanvasEdgeCommand,
  createCanvasNodeCommand,
  createCanvasNodeCommandUpdates,
  deleteCanvasEdgesCommand,
  deleteCanvasSelectionCommand,
  patchCanvasEdgesCommand,
  patchCanvasNodeDataCommand,
  resizeCanvasNodeCommand,
  resizeCanvasNodesCommand,
  setCanvasNodePositionsCommand,
} from './canvas-document-commands'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import {
  assertCanvasMapsShareDocument,
  transactCanvasMap,
  transactCanvasMaps,
} from './canvas-yjs-transactions'
import { clearStrokePathCache } from '../../nodes/stroke/stroke-path-cache'
import type * as Y from 'yjs'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

interface CreateCanvasDocumentWriterOptions {
  canEdit?: boolean
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
}

export function createCanvasDocumentWriter({
  canEdit = true,
  nodesMap,
  edgesMap,
}: CreateCanvasDocumentWriterOptions): CanvasDocumentWriter {
  assertCanvasMapsShareDocument(nodesMap, edgesMap, 'createCanvasDocumentWriter')

  const getNextDocumentZIndex = () =>
    getNextCanvasElementZIndex([...Array.from(nodesMap.values()), ...Array.from(edgesMap.values())])

  const completed = (
    command: CanvasDocumentCommandType,
    affectedCount: number,
  ): CanvasDocumentCommandResult => ({
    type: 'completed',
    command,
    affectedCount,
  })
  const skipped = (
    command: CanvasDocumentCommandType,
    reason: Extract<CanvasDocumentCommandResult, { type: 'skipped' }>['reason'],
  ): CanvasDocumentCommandResult => ({ type: 'skipped', command, reason })
  const rejected = (command: CanvasDocumentCommandType): CanvasDocumentCommandResult => ({
    type: 'rejected',
    command,
    reason: 'readonly',
  })
  const failed = (
    command: CanvasDocumentCommandType,
    error: unknown,
  ): CanvasDocumentCommandResult => ({
    type: 'failed',
    command,
    reason: isDuplicateCanvasIdError(error) ? 'duplicate-id' : 'exception',
    error,
  })

  const targetCount = (ids: Iterable<string>, map: { has: (key: string) => boolean }) => {
    let count = 0
    for (const id of ids) {
      if (map.has(id)) count += 1
    }
    return count
  }

  const runMeasuredNodeBatchCommand = ({
    command,
    updates,
    metricName,
    apply,
  }: {
    command: Extract<
      CanvasDocumentCommandType,
      'patchNodeData' | 'resizeNodes' | 'setNodePositions'
    >
    updates: ReadonlyMap<string, unknown>
    metricName: string
    apply: () => void
  }) => {
    if (updates.size === 0) return skipped(command, 'empty')
    const affectedCount = targetCount(updates.keys(), nodesMap)
    if (affectedCount === 0) return skipped(command, 'unavailable-target')
    transactCanvasMap(nodesMap, () => {
      measureCanvasPerformance(metricName, { nodeCount: updates.size }, apply)
    })
    return completed(command, affectedCount)
  }

  const commandHandlers: CanvasDocumentCommandHandlers = {
    createNode: (command) => {
      transactCanvasMap(nodesMap, () => {
        createCanvasNodeCommand({
          nodesMap,
          node: command.node,
          sanitizeNode: sanitizeNodeForPersistence,
          nextZIndex: getNextDocumentZIndex(),
        })
      })
      return completed(command.type, 1)
    },
    createNodes: (command) => {
      if (command.nodes.length === 0) return skipped(command.type, 'empty')
      const nodeUpdates = createCanvasNodeCommandUpdates({
        nodesMap,
        nodes: command.nodes,
        sanitizeNode: sanitizeNodeForPersistence,
        nextZIndex: getNextDocumentZIndex(),
        operation: 'createNodes',
      })

      transactCanvasMap(nodesMap, () => {
        measureCanvasPerformance(
          'canvas.document.nodes.create',
          { nodeCount: command.nodes.length },
          () => {
            for (const update of nodeUpdates) {
              nodesMap.set(update.id, update.node)
            }
          },
        )
      })
      return completed(command.type, command.nodes.length)
    },
    patchNodeData: (command) => {
      return runMeasuredNodeBatchCommand({
        command: command.type,
        updates: command.updates,
        metricName: 'canvas.document.nodes.patch-data',
        apply: () => {
          patchCanvasNodeDataCommand({
            nodesMap,
            updates: command.updates,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        },
      })
    },
    patchEdges: (command) => {
      if (command.updates.size === 0) return skipped(command.type, 'empty')
      const affectedCount = targetCount(command.updates.keys(), edgesMap)
      if (affectedCount === 0) return skipped(command.type, 'unavailable-target')
      transactCanvasMap(edgesMap, () => {
        measureCanvasPerformance(
          'canvas.document.edges.patch',
          { edgeCount: command.updates.size },
          () => {
            patchCanvasEdgesCommand({
              edgesMap,
              updates: command.updates,
            })
          },
        )
      })
      return completed(command.type, affectedCount)
    },
    resizeNode: (command) => {
      if (!nodesMap.has(command.nodeId)) return skipped(command.type, 'unavailable-target')
      transactCanvasMap(nodesMap, () => {
        resizeCanvasNodeCommand({
          nodesMap,
          nodeId: command.nodeId,
          width: command.width,
          height: command.height,
          position: command.position,
          sanitizeNode: sanitizeNodeForPersistence,
        })
      })
      return completed(command.type, 1)
    },
    resizeNodes: (command) => {
      return runMeasuredNodeBatchCommand({
        command: command.type,
        updates: command.updates,
        metricName: 'canvas.document.nodes.resize',
        apply: () => {
          resizeCanvasNodesCommand({
            nodesMap,
            updates: command.updates,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        },
      })
    },
    deleteNodes: (command) => {
      if (command.nodeIds.size === 0) return skipped(command.type, 'empty')
      let deletion = { nodeCount: 0, edgeCount: 0 }
      transactCanvasMaps(nodesMap, edgesMap, () => {
        measureCanvasPerformance(
          'canvas.document.nodes.delete',
          { nodeCount: command.nodeIds.size },
          () => {
            deletion = deleteCanvasSelectionCommand({
              nodesMap,
              edgesMap,
              selection: { nodeIds: command.nodeIds, edgeIds: new Set() },
            })
          },
        )
      })
      for (const nodeId of command.nodeIds) {
        clearStrokePathCache(nodeId)
      }
      const affectedCount = deletion.nodeCount + deletion.edgeCount
      return affectedCount > 0
        ? completed(command.type, affectedCount)
        : skipped(command.type, 'unavailable-target')
    },
    createEdge: (command) => {
      transactCanvasMap(edgesMap, () => {
        createCanvasEdgeCommand({
          edgesMap,
          connection: command.connection,
          defaults: command.defaults,
          nextZIndex: getNextDocumentZIndex(),
        })
      })
      return completed(command.type, 1)
    },
    deleteEdges: (command) => {
      if (command.edgeIds.size === 0) return skipped(command.type, 'empty')
      const affectedCount = targetCount(command.edgeIds, edgesMap)
      if (affectedCount === 0) return skipped(command.type, 'unavailable-target')
      transactCanvasMap(edgesMap, () => {
        measureCanvasPerformance(
          'canvas.document.edges.delete',
          { edgeCount: command.edgeIds.size },
          () => {
            deleteCanvasEdgesCommand({ edgesMap, edgeIds: command.edgeIds })
          },
        )
      })
      return completed(command.type, affectedCount)
    },
    setNodePositions: (command) => {
      return runMeasuredNodeBatchCommand({
        command: command.type,
        updates: command.positions,
        metricName: 'canvas.document.nodes.set-position',
        apply: () => {
          setCanvasNodePositionsCommand({
            nodesMap,
            positions: command.positions,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        },
      })
    },
  }

  const execute = (command: CanvasDocumentCommand): CanvasDocumentCommandResult => {
    if (!canEdit) return rejected(command.type)

    try {
      return runCanvasDocumentCommand(commandHandlers, command)
    } catch (error) {
      return failed(command.type, error)
    }
  }

  const executeOrThrow = (command: CanvasDocumentCommand) => {
    const result = execute(command)
    if (result.type === 'failed') {
      throw result.error
    }
    return result
  }

  return {
    execute,
    createNode: (node) => void executeOrThrow({ type: 'createNode', node }),
    createNodes: (nodes) => void executeOrThrow({ type: 'createNodes', nodes }),
    patchNodeData: (updates) => void executeOrThrow({ type: 'patchNodeData', updates }),
    patchEdges: (updates) => void executeOrThrow({ type: 'patchEdges', updates }),
    resizeNode: (nodeId, width, height, position) =>
      void executeOrThrow({ type: 'resizeNode', nodeId, width, height, position }),
    resizeNodes: (updates) => void executeOrThrow({ type: 'resizeNodes', updates }),
    deleteNodes: (nodeIds) => void executeOrThrow({ type: 'deleteNodes', nodeIds }),
    createEdge: (connection, defaults) =>
      void executeOrThrow({ type: 'createEdge', connection, defaults }),
    deleteEdges: (edgeIds) => void executeOrThrow({ type: 'deleteEdges', edgeIds }),
    setNodePositions: (positions) => void executeOrThrow({ type: 'setNodePositions', positions }),
  }
}

type CanvasDocumentCommandHandler<TCommand extends CanvasDocumentCommand> = (
  command: TCommand,
) => CanvasDocumentCommandResult

type CanvasDocumentCommandHandlers = {
  [TType in CanvasDocumentCommandType]: CanvasDocumentCommandHandler<
    Extract<CanvasDocumentCommand, { type: TType }>
  >
}

function runCanvasDocumentCommand(
  handlers: CanvasDocumentCommandHandlers,
  command: CanvasDocumentCommand,
): CanvasDocumentCommandResult {
  const handler = handlers[command.type] as CanvasDocumentCommandHandler<CanvasDocumentCommand>
  return handler(command)
}

function isDuplicateCanvasIdError(error: unknown) {
  return error instanceof Error && /^Canvas (node|edge) ".+" already exists$/.test(error.message)
}
