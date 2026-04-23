import { useLayoutEffect, useRef, useState } from 'react'
import { getCanvasEdgeContextMenuContributors } from '../../edges/canvas-edge-registry'
import { getCanvasNodeContextMenuContributors } from '../../nodes/canvas-node-modules'
import { parseEmbedNodeData } from '../../nodes/embed/embed-node-data'
import { createAndSelectEmbeddedCanvasNode } from '../document/canvas-document-commands'
import { buildCanvasContextMenu } from './canvas-context-menu-registry'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuContext,
  CanvasContextMenuPoint,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'

interface UseCanvasContextMenuOptions {
  activeTool: string
  canEdit: boolean
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  createNode: (node: Node) => void
  screenToFlowPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  selection: Pick<CanvasSelectionController, 'clear' | 'getSnapshot' | 'replace'>
  commands: CanvasContextMenuCommands
}

type PointerPosition = { x: number; y: number }

function getSelectionItemCount(selection: CanvasContextMenuContext['selection']) {
  return selection.nodeIds.length + selection.edgeIds.length
}

function getSingleSelectionType(
  selection: CanvasContextMenuContext['selection'],
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
) {
  if (selection.edgeIds.length === 0 && selection.nodeIds.length > 0) {
    const nodeTypes = new Set(
      selection.nodeIds
        .map((nodeId) => nodesMap.get(nodeId)?.type)
        .filter((type) => type !== undefined),
    )
    return nodeTypes.size === 1 ? { kind: 'node' as const, type: [...nodeTypes][0] } : null
  }

  if (selection.nodeIds.length === 0 && selection.edgeIds.length > 0) {
    const edgeTypes = new Set(
      selection.edgeIds
        .map((edgeId) => edgesMap.get(edgeId)?.type)
        .filter((type) => type !== undefined),
    )
    return edgeTypes.size === 1 ? { kind: 'edge' as const, type: [...edgeTypes][0] } : null
  }

  return null
}

function normalizeContextMenuEvent(event: MouseEvent | React.MouseEvent) {
  const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
  event.preventDefault()
  event.stopPropagation()
  nativeEvent.stopImmediatePropagation?.()

  return {
    x: nativeEvent.clientX,
    y: nativeEvent.clientY,
  }
}

export function useCanvasContextMenu({
  activeTool,
  canEdit,
  campaignId,
  canvasParentId,
  nodesMap,
  edgesMap,
  createNode,
  screenToFlowPosition,
  selection,
  commands,
}: UseCanvasContextMenuOptions) {
  const hostRef = useRef<ContextMenuHostRef>(null)
  const pendingOpenPositionRef = useRef<PointerPosition | null>(null)
  const [menuContext, setMenuContext] = useState<CanvasContextMenuContext | null>(null)
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()

  const resolveSelectedEmbedItem = (selectionSnapshot: CanvasContextMenuContext['selection']) => {
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

  const services = {
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

      try {
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
      } catch (error) {
        console.error('Failed to create embedded sidebar item from canvas context menu', {
          campaignId,
          canvasParentId,
          type,
          error,
        })
        return null
      }
    },
  } satisfies CanvasContextMenuServices

  useLayoutEffect(() => {
    if (!menuContext || !pendingOpenPositionRef.current) {
      return
    }

    hostRef.current?.open(pendingOpenPositionRef.current)
    pendingOpenPositionRef.current = null
  }, [menuContext])

  const openMenu = (
    position: PointerPosition,
    nextSelection: CanvasContextMenuContext['selection'],
  ) => {
    if (activeTool !== 'select') {
      return
    }

    pendingOpenPositionRef.current = position
    setMenuContext({
      surface: 'canvas',
      pointerPosition: position,
      selection: nextSelection,
      canEdit,
    })
  }

  const close = () => {
    // `close` is the full programmatic teardown path: clear pending open state,
    // reset menu context, and tell the host to dismiss immediately.
    pendingOpenPositionRef.current = null
    setMenuContext(null)
    hostRef.current?.close()
  }

  const openForPane = (event: MouseEvent | React.MouseEvent) => {
    const position = normalizeContextMenuEvent(event)
    const nextSelection = { nodeIds: [], edgeIds: [] }
    selection.clear()
    openMenu(position, nextSelection)
  }

  const openForNode = (event: React.MouseEvent, node: Node) => {
    const position = normalizeContextMenuEvent(event)
    const currentSelection = selection.getSnapshot()
    const nextSelection = currentSelection.nodeIds.includes(node.id)
      ? currentSelection
      : { nodeIds: [node.id], edgeIds: [] }

    if (nextSelection !== currentSelection) {
      selection.replace(nextSelection)
    }

    openMenu(position, nextSelection)
  }

  const openForEdge = (event: React.MouseEvent, edge: Edge) => {
    const position = normalizeContextMenuEvent(event)
    const currentSelection = selection.getSnapshot()
    const nextSelection = currentSelection.edgeIds.includes(edge.id)
      ? currentSelection
      : { nodeIds: [], edgeIds: [edge.id] }

    if (nextSelection !== currentSelection) {
      selection.replace(nextSelection)
    }

    openMenu(position, nextSelection)
  }

  const selectionType =
    menuContext && getSelectionItemCount(menuContext.selection) > 0
      ? getSingleSelectionType(menuContext.selection, nodesMap, edgesMap)
      : null
  const selectionContributors =
    selectionType?.kind === 'node'
      ? getCanvasNodeContextMenuContributors(selectionType.type)
      : selectionType?.kind === 'edge'
        ? getCanvasEdgeContextMenuContributors(selectionType.type)
        : []

  return {
    close,
    hostRef,
    menu: menuContext
      ? buildCanvasContextMenu({
          context: menuContext,
          services,
          commands,
          contributors: selectionContributors,
        })
      : { groups: [], flatItems: [], isEmpty: true },
    // `onClose` is host-driven dismissal only; the host already handled its own
    // teardown, so this just clears the hook state.
    onClose: () => setMenuContext(null),
    openForEdge,
    openForNode,
    openForPane,
  }
}
