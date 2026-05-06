import { useLayoutEffect, useRef, useState } from 'react'
import {
  createAndSelectEmbeddedCanvasNode,
  createAndSelectTextCanvasNode,
} from '../document/canvas-document-commands'
import { buildCanvasContextMenu } from './canvas-context-menu-registry'
import { resolveCanvasContextMenuTarget } from './canvas-context-menu-target'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuContext,
  CanvasContextMenuContributor,
  CanvasContextMenuPoint,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import type { BuiltContextMenu } from '~/features/context-menu/types'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'

interface UseCanvasContextMenuOptions {
  activeTool: string
  canEdit: boolean
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  createNode: (node: CanvasDocumentNode) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setPendingEditNodePoint: (point: CanvasContextMenuPoint | null) => void
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  selection: Pick<CanvasSelectionController, 'clearSelection' | 'getSnapshot' | 'setSelection'>
  commands: CanvasContextMenuCommands
}

type PointerPosition = { x: number; y: number }
const EMPTY_CONTEXT_MENU: BuiltContextMenu = { groups: [], flatItems: [], isEmpty: true }

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
  setPendingEditNodeId,
  setPendingEditNodePoint,
  screenToCanvasPosition,
  selection,
  commands,
}: UseCanvasContextMenuOptions) {
  const hostRef = useRef<ContextMenuHostRef>(null)
  const pendingOpenPositionRef = useRef<PointerPosition | null>(null)
  const [menuState, setMenuState] = useState<{
    context: CanvasContextMenuContext
    contributors: ReadonlyArray<CanvasContextMenuContributor>
  } | null>(null)
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()

  const services = {
    hasSelectableCanvasItems: () => nodesMap.size > 0 || edgesMap.size > 0,
    selectAllCanvasItems: () => {
      selection.setSelection({
        nodeIds: new Set(nodesMap.keys()),
        edgeIds: new Set(edgesMap.keys()),
      })
    },
    canOpenEmbedTarget: (target) =>
      target.kind === 'embed-node' && itemsMap.has(target.sidebarItemId),
    openEmbedTarget: async (target) => {
      if (target.kind !== 'embed-node') {
        return false
      }

      const item = itemsMap.get(target.sidebarItemId)
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
          screenToCanvasPosition,
          createNode,
          setSelection: selection.setSelection,
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
    createTextNode: (pointerPosition) => {
      if (!canEdit) {
        return null
      }

      return createAndSelectTextCanvasNode({
        pointerPosition,
        screenToCanvasPosition,
        createNode,
        setSelection: selection.setSelection,
        setPendingEditNodeId,
        setPendingEditNodePoint,
      })
    },
  } satisfies CanvasContextMenuServices

  useLayoutEffect(() => {
    if (!menuState || !pendingOpenPositionRef.current) {
      return
    }

    hostRef.current?.open(pendingOpenPositionRef.current)
    pendingOpenPositionRef.current = null
  }, [menuState])

  const openMenu = (
    position: PointerPosition,
    nextSelection: CanvasContextMenuContext['selection'],
  ) => {
    if (activeTool !== 'select') {
      return
    }

    const resolvedSelection = resolveCanvasContextMenuTarget(nextSelection, nodesMap, edgesMap)
    pendingOpenPositionRef.current = position
    setMenuState({
      context: {
        surface: 'canvas',
        pointerPosition: position,
        selection: nextSelection,
        target: resolvedSelection.target,
        canEdit,
      },
      contributors: resolvedSelection.contributors,
    })
  }

  const close = () => {
    // `close` is the full programmatic teardown path: clear pending open state,
    // reset menu context, and tell the host to dismiss immediately.
    pendingOpenPositionRef.current = null
    setMenuState(null)
    hostRef.current?.close()
  }

  const openForPane = (event: MouseEvent | React.MouseEvent) => {
    const position = normalizeContextMenuEvent(event)
    const nextSelection = { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
    selection.clearSelection()
    openMenu(position, nextSelection)
  }

  const openForNode = (event: React.MouseEvent, node: CanvasDocumentNode) => {
    const position = normalizeContextMenuEvent(event)
    const currentSelection = selection.getSnapshot()
    const nextSelection = currentSelection.nodeIds.has(node.id)
      ? currentSelection
      : { nodeIds: new Set([node.id]), edgeIds: new Set<string>() }

    if (nextSelection !== currentSelection) {
      selection.setSelection(nextSelection)
    }

    openMenu(position, nextSelection)
  }

  const openForEdge = (event: React.MouseEvent, edge: CanvasDocumentEdge) => {
    const position = normalizeContextMenuEvent(event)
    const currentSelection = selection.getSnapshot()
    const nextSelection = currentSelection.edgeIds.has(edge.id)
      ? currentSelection
      : { nodeIds: new Set<string>(), edgeIds: new Set([edge.id]) }

    if (nextSelection !== currentSelection) {
      selection.setSelection(nextSelection)
    }

    openMenu(position, nextSelection)
  }

  return {
    close,
    hostRef,
    menu: menuState
      ? buildCanvasContextMenu({
          context: menuState.context,
          services,
          commands,
          contributors: menuState.contributors,
        })
      : EMPTY_CONTEXT_MENU,
    // `onClose` is host-driven dismissal only; the host already handled its own
    // teardown, so this just clears the hook state.
    onClose: () => setMenuState(null),
    openForEdge,
    openForNode,
    openForPane,
  }
}
