import { useMemo } from 'react'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import {
  getOrderedCanvasElements,
  getNextCanvasElementZIndex,
  reorderCanvasElements,
} from '../document/canvas-stack-order'
import { useCanvasClipboardStore } from './use-canvas-clipboard-store'
import type { CanvasContextMenuServices } from './canvas-context-menu-types'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

const CANVAS_PASTE_OFFSET = 32

interface UseCanvasContextMenuServicesOptions {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

function transactCanvasMaps(nodesMap: Y.Map<Node>, edgesMap: Y.Map<Edge>, fn: () => void) {
  const doc = nodesMap.doc ?? edgesMap.doc
  if (doc) {
    doc.transact(fn)
    return
  }

  fn()
}

function cloneCanvasNode(node: Node): Node {
  return structuredClone(stripEphemeralCanvasNodeState(node))
}

function cloneCanvasEdge(edge: Edge): Edge {
  return structuredClone(edge)
}

function getCurrentCanvasNodes(nodesMap: Y.Map<Node>) {
  return getOrderedCanvasElements(Array.from(nodesMap.values()).map(stripEphemeralCanvasNodeState))
}

function getCurrentCanvasEdges(edgesMap: Y.Map<Edge>) {
  return getOrderedCanvasElements(Array.from(edgesMap.values()))
}

function buildClipboardSelection(
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
) {
  const selectedNodes = getCurrentCanvasNodes(nodesMap).filter((node) =>
    selection.nodeIds.includes(node.id),
  )
  if (selectedNodes.length === 0) {
    return null
  }

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
  const selectedEdges = getCurrentCanvasEdges(edgesMap).filter(
    (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
  )

  return {
    nodes: selectedNodes.map(cloneCanvasNode),
    edges: selectedEdges.map(cloneCanvasEdge),
  }
}

function getDeletionSelection(
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
): CanvasSelectionSnapshot {
  if (selection.nodeIds.length === 0) {
    return selection
  }

  const nodeIdSet = new Set(selection.nodeIds)
  const edgeIds = new Set(selection.edgeIds)
  for (const edge of edgesMap.values()) {
    if (nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target)) {
      edgeIds.add(edge.id)
    }
  }

  return {
    nodeIds: selection.nodeIds,
    edgeIds: [...edgeIds],
  }
}

export function useCanvasContextMenuServices({
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasContextMenuServicesOptions): CanvasContextMenuServices {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)

  return useMemo(() => {
    const canPaste = () => canEdit && clipboard !== null && clipboard.nodes.length > 0

    const copySnapshot = (snapshot: CanvasSelectionSnapshot) => {
      const clipboardSelection = buildClipboardSelection(nodesMap, edgesMap, snapshot)
      if (!clipboardSelection) {
        return false
      }

      setClipboard({
        ...clipboardSelection,
        pasteCount: 0,
      })
      return true
    }

    const pasteClipboard = () => {
      if (!canPaste() || !clipboard) {
        return null
      }

      const nodeIdMap = new Map<string, string>()
      const offset = CANVAS_PASTE_OFFSET * (clipboard.pasteCount + 1)
      const currentNodes = getCurrentCanvasNodes(nodesMap)
      const currentEdges = getCurrentCanvasEdges(edgesMap)
      const nextNodeZIndex = getNextCanvasElementZIndex(currentNodes)
      const nextEdgeZIndex = getNextCanvasElementZIndex(currentEdges)

      const nextNodes = clipboard.nodes.map((node, index) => {
        const nextId = crypto.randomUUID()
        nodeIdMap.set(node.id, nextId)
        return {
          ...cloneCanvasNode(node),
          id: nextId,
          position: {
            x: node.position.x + offset,
            y: node.position.y + offset,
          },
          zIndex: nextNodeZIndex + index,
        }
      })

      const nextEdges = clipboard.edges.flatMap((edge, index) => {
        const source = nodeIdMap.get(edge.source)
        const target = nodeIdMap.get(edge.target)
        if (!source || !target) {
          return []
        }

        return [
          {
            ...cloneCanvasEdge(edge),
            id: `e-${source}-${target}-${crypto.randomUUID()}`,
            source,
            target,
            zIndex: nextEdgeZIndex + index,
          },
        ]
      })

      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const node of nextNodes) {
          nodesMap.set(node.id, node)
        }
        for (const edge of nextEdges) {
          edgesMap.set(edge.id, edge)
        }
        incrementPasteCount()
      })

      const pastedSelection = {
        nodeIds: nextNodes.map((node) => node.id),
        edgeIds: nextEdges.map((edge) => edge.id),
      }
      selection.replace(pastedSelection)
      return pastedSelection
    }

    return {
      canPaste,
      canCopySnapshot: (snapshot) => buildClipboardSelection(nodesMap, edgesMap, snapshot) !== null,
      copySnapshot,
      cutSnapshot: (snapshot) => {
        if (!canEdit) {
          return false
        }

        const copied = buildClipboardSelection(nodesMap, edgesMap, snapshot)
        if (!copied) {
          return false
        }

        const deletionSelection = getDeletionSelection(edgesMap, snapshot)
        transactCanvasMaps(nodesMap, edgesMap, () => {
          setClipboard({
            ...copied,
            pasteCount: 0,
          })
          for (const edgeId of deletionSelection.edgeIds) {
            edgesMap.delete(edgeId)
          }
          for (const nodeId of deletionSelection.nodeIds) {
            nodesMap.delete(nodeId)
          }
        })
        selection.clear()
        return true
      },
      pasteClipboard,
      duplicateSnapshot: (snapshot) => {
        if (!canEdit || !copySnapshot(snapshot)) {
          return null
        }

        return pasteClipboard()
      },
      deleteSnapshot: (snapshot) => {
        if (!canEdit) {
          return false
        }

        const deletionSelection = getDeletionSelection(edgesMap, snapshot)
        if (deletionSelection.nodeIds.length === 0 && deletionSelection.edgeIds.length === 0) {
          return false
        }

        transactCanvasMaps(nodesMap, edgesMap, () => {
          for (const edgeId of deletionSelection.edgeIds) {
            edgesMap.delete(edgeId)
          }
          for (const nodeId of deletionSelection.nodeIds) {
            nodesMap.delete(nodeId)
          }
        })
        selection.clear()
        return true
      },
      reorderSnapshot: (snapshot, direction) => {
        if (!canEdit) {
          return false
        }

        const hasNodes = snapshot.nodeIds.length > 0
        const hasEdges = snapshot.edgeIds.length > 0
        if (!hasNodes && !hasEdges) {
          return false
        }

        const reorderedNodes = hasNodes
          ? reorderCanvasElements(getCurrentCanvasNodes(nodesMap), snapshot.nodeIds, direction)
          : null
        const reorderedEdges = hasEdges
          ? reorderCanvasElements(getCurrentCanvasEdges(edgesMap), snapshot.edgeIds, direction)
          : null

        transactCanvasMaps(nodesMap, edgesMap, () => {
          reorderedNodes?.forEach((node) => {
            nodesMap.set(node.id, node)
          })
          reorderedEdges?.forEach((edge) => {
            edgesMap.set(edge.id, edge)
          })
        })

        return true
      },
    } satisfies CanvasContextMenuServices
  }, [canEdit, clipboard, edgesMap, incrementPasteCount, nodesMap, selection, setClipboard])
}
