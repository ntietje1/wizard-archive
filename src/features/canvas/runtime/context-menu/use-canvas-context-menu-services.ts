import { createEmbedCanvasNode } from '../../nodes/embed/embed-node-creation'
import { parseEmbedNodeData } from '../../nodes/embed/embed-node-data'
import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasClipboardStore } from './use-canvas-clipboard-store'
import { createCanvasClipboardEntry, materializeCanvasPaste } from './canvas-context-menu-clipboard'
import { createCanvasReorderUpdates } from './canvas-context-menu-reorder'
import { getCanvasDeletionSelection } from './canvas-context-menu-selection'
import type { CanvasContextMenuPoint, CanvasContextMenuServices } from './canvas-context-menu-types'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'

interface UseCanvasContextMenuServicesOptions {
  canEdit: boolean
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  createNode: (node: Node) => void
  screenToFlowPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export function useCanvasContextMenuServices({
  canEdit,
  campaignId,
  canvasParentId,
  nodesMap,
  edgesMap,
  createNode,
  screenToFlowPosition,
  selection,
}: UseCanvasContextMenuServicesOptions): CanvasContextMenuServices {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()

  const canPaste = () => canEdit && clipboard !== null && clipboard.nodes.length > 0
  const resolveSelectedEmbedItem = (selectionSnapshot: CanvasSelectionSnapshot) => {
    if (selectionSnapshot.edgeIds.length > 0 || selectionSnapshot.nodeIds.length !== 1) {
      return null
    }

    const selectedNode = nodesMap.get(selectionSnapshot.nodeIds[0])
    if (selectedNode?.type !== 'embed') {
      return null
    }

    const sidebarItemId = parseEmbedNodeData(selectedNode.data).sidebarItemId
    if (!sidebarItemId) {
      return null
    }

    return itemsMap.get(sidebarItemId) ?? null
  }

  return {
    canPaste,
    canCopySnapshot: (snapshot) =>
      createCanvasClipboardEntry(nodesMap, edgesMap, snapshot) !== null,
    canOpenEmbedSelection: (selectionSnapshot) =>
      resolveSelectedEmbedItem(selectionSnapshot) !== null,
    copySnapshot: (snapshot) => {
      const nextClipboard = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
      if (!nextClipboard) {
        return false
      }

      setClipboard(nextClipboard)
      return true
    },
    cutSnapshot: (snapshot) => {
      if (!canEdit) {
        return false
      }

      const copied = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
      if (!copied) {
        return false
      }

      const deletionSelection = getCanvasDeletionSelection(edgesMap, snapshot)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        setClipboard(copied)
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
    pasteClipboard: () => {
      if (!canEdit || !clipboard || clipboard.nodes.length === 0) {
        return null
      }

      const paste = materializeCanvasPaste(nodesMap, edgesMap, clipboard)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const node of paste.nodes) {
          nodesMap.set(node.id, node)
        }
        for (const edge of paste.edges) {
          edgesMap.set(edge.id, edge)
        }
        incrementPasteCount()
      })

      selection.replace(paste.selection)
      return paste.selection
    },
    duplicateSnapshot: (snapshot) => {
      if (!canEdit) {
        return null
      }

      const nextClipboard = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
      if (!nextClipboard) {
        return null
      }

      setClipboard(nextClipboard)

      const paste = materializeCanvasPaste(nodesMap, edgesMap, nextClipboard)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const node of paste.nodes) {
          nodesMap.set(node.id, node)
        }
        for (const edge of paste.edges) {
          edgesMap.set(edge.id, edge)
        }
        incrementPasteCount()
      })

      selection.replace(paste.selection)
      return paste.selection
    },
    openEmbedSelection: async (selectionSnapshot) => {
      const item = resolveSelectedEmbedItem(selectionSnapshot)
      if (!item) {
        return false
      }

      await navigateToItem(item.slug)
      return true
    },
    deleteSnapshot: (snapshot) => {
      if (!canEdit) {
        return false
      }

      const deletionSelection = getCanvasDeletionSelection(edgesMap, snapshot)
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

      const reorderUpdates = createCanvasReorderUpdates(nodesMap, edgesMap, snapshot, direction)
      if (!reorderUpdates) {
        return false
      }

      transactCanvasMaps(nodesMap, edgesMap, () => {
        reorderUpdates.nodes?.forEach((node) => {
          nodesMap.set(node.id, node)
        })
        reorderUpdates.edges?.forEach((edge) => {
          edgesMap.set(edge.id, edge)
        })
      })

      return true
    },
    createAndEmbedSidebarItem: async (type, pointerPosition) => {
      if (!canEdit) {
        return null
      }

      const result = await createItem({
        type,
        campaignId,
        parentTarget: { kind: 'direct', parentId: canvasParentId },
        name: getDefaultName(type, canvasParentId),
      })

      const embedNode = createEmbedCanvasNode(result.id, screenToFlowPosition(pointerPosition))
      createNode(embedNode)

      const nextSelection = { nodeIds: [embedNode.id], edgeIds: [] }
      selection.replace(nextSelection)
      return nextSelection
    },
  } satisfies CanvasContextMenuServices
}
