import { parseEmbedNodeData } from '../../nodes/embed/embed-node-data'
import { createAndSelectEmbeddedCanvasNode } from '../document/canvas-document-commands'
import { useCanvasSelectionOperations } from '../document/use-canvas-selection-operations'
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
  const selectionOperations = useCanvasSelectionOperations({
    canEdit,
    nodesMap,
    edgesMap,
    selection,
  })
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()
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
    ...selectionOperations,
    canOpenEmbedSelection: (selectionSnapshot) =>
      resolveSelectedEmbedItem(selectionSnapshot) !== null,
    openEmbedSelection: async (selectionSnapshot) => {
      const item = resolveSelectedEmbedItem(selectionSnapshot)
      if (!item) {
        return false
      }

      await navigateToItem(item.slug)
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

      return createAndSelectEmbeddedCanvasNode({
        sidebarItemId: result.id,
        pointerPosition,
        screenToFlowPosition,
        createNode,
        replaceSelection: selection.replace,
      })
    },
  } satisfies CanvasContextMenuServices
}
