import { useLayoutEffect, useRef, useState } from 'react'
import {
  createAndSelectEmbedCanvasNode,
  createAndSelectTextCanvasNode,
} from '../document/canvas-document-commands'
import { buildCanvasContextMenu } from './canvas-context-menu-registry'
import { resolveCanvasContextMenuTarget } from './canvas-context-menu-target'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuContext,
  CanvasContextMenuContributor,
  CanvasContextMenuItem,
  CanvasContextMenuPoint,
  CanvasContextMenuTarget,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import type { BuiltContextMenu } from '~/features/context-menu/types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

interface UseCanvasContextMenuCoreOptions {
  activeTool: string
  canEdit: boolean
  canvasEngine: CanvasEngine
  createItems?: ReadonlyArray<CanvasContextMenuItem>
  createNode: (node: CanvasDocumentNode) => void
  getTargetContributors?: (
    target: CanvasContextMenuTarget,
  ) => ReadonlyArray<CanvasContextMenuContributor>
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

export function useCanvasContextMenuCore({
  activeTool,
  canEdit,
  canvasEngine,
  createItems = [],
  createNode,
  getTargetContributors,
  setPendingEditNodeId,
  setPendingEditNodePoint,
  screenToCanvasPosition,
  selection,
  commands,
}: UseCanvasContextMenuCoreOptions) {
  const hostRef = useRef<ContextMenuHostRef>(null)
  const pendingOpenPositionRef = useRef<PointerPosition | null>(null)
  const [menuContext, setMenuContext] = useState<CanvasContextMenuContext | null>(null)

  const services = {
    hasSelectableCanvasItems: () => {
      const snapshot = canvasEngine.getSnapshot()
      return snapshot.nodeIds.length > 0 || snapshot.edgeIds.length > 0
    },
    selectAllCanvasItems: () => {
      const snapshot = canvasEngine.getSnapshot()
      selection.setSelection({
        nodeIds: new Set(snapshot.nodeIds),
        edgeIds: new Set(snapshot.edgeIds),
      })
    },
    createEmbedNode: (pointerPosition) => {
      if (!canEdit) {
        return null
      }

      return createAndSelectEmbedCanvasNode({
        target: { kind: 'empty' },
        pointerPosition,
        screenToCanvasPosition,
        createNode,
        setSelection: selection.setSelection,
      })
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

    const target = resolveCanvasContextMenuTarget(nextSelection, canvasEngine.getSnapshot())
    pendingOpenPositionRef.current = position
    setMenuContext({
      surface: 'canvas',
      pointerPosition: position,
      selection: nextSelection,
      target,
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
    menu: menuContext
      ? buildCanvasContextMenu({
          context: menuContext,
          services,
          commands,
          createItems,
          contributors: getTargetContributors?.(menuContext.target) ?? [],
        })
      : EMPTY_CONTEXT_MENU,
    // `onClose` is host-driven dismissal only; the host already handled its own
    // teardown, so this just clears the hook state.
    onClose: () => setMenuContext(null),
    openForEdge,
    openForNode,
    openForPane,
  }
}
