import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { getCanvasEdgeContextMenuContributors } from '../../edges/canvas-edge-registry'
import { getCanvasNodeContextMenuContributors } from '../../nodes/canvas-node-registry'
import { useCanvasSelectionSnapshot } from '../selection/use-canvas-selection-state'
import { buildMenu } from '~/features/context-menu/menu-builder'
import { ContextMenuHost } from '~/features/context-menu/components/context-menu-host'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import {
  canvasContextMenuCommands,
  canvasContextMenuContributors,
  canvasContextMenuGroupConfig,
} from './canvas-context-menu-registry'
import { useCanvasContextMenuServices } from './use-canvas-context-menu-services'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasContextMenuContext } from './canvas-context-menu-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface CanvasContextMenuProps {
  activeTool: string
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selectionController: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export interface CanvasContextMenuRef {
  close: () => void
  onPaneContextMenu: (event: MouseEvent | React.MouseEvent) => void
  onNodeContextMenu: (event: React.MouseEvent, node: Node) => void
  onEdgeContextMenu: (event: React.MouseEvent, edge: Edge) => void
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

export const CanvasContextMenu = forwardRef<CanvasContextMenuRef, CanvasContextMenuProps>(
  ({ activeTool, canEdit, nodesMap, edgesMap, selectionController }, ref) => {
    const hostRef = useRef<ContextMenuHostRef>(null)
    const selection = useCanvasSelectionSnapshot()
    const services = useCanvasContextMenuServices({
      canEdit,
      nodesMap,
      edgesMap,
      selection: selectionController,
    })
    const [menuContext, setMenuContext] = useState<CanvasContextMenuContext | null>(null)
    const latestSelectionRef = useRef(selection)
    const activeToolRef = useRef(activeTool)
    const canEditRef = useRef(canEdit)
    const pendingOpenPositionRef = useRef<PointerPosition | null>(null)
    latestSelectionRef.current = selection
    activeToolRef.current = activeTool
    canEditRef.current = canEdit
    const openMenuRef = useRef(
      (position: PointerPosition, nextSelection: CanvasContextMenuContext['selection']) => {
        if (activeToolRef.current !== 'select') {
          return
        }

        pendingOpenPositionRef.current = position
        setMenuContext({
          surface: 'canvas',
          pointerPosition: position,
          selection: nextSelection,
          canEdit: canEditRef.current,
        })
      },
    )

    useLayoutEffect(() => {
      if (!menuContext || !pendingOpenPositionRef.current) {
        return
      }

      hostRef.current?.open(pendingOpenPositionRef.current)
      pendingOpenPositionRef.current = null
    }, [menuContext])

    useImperativeHandle(
      ref,
      () => ({
        close: () => {
          hostRef.current?.close()
        },
        onPaneContextMenu: (event) => {
          const position = normalizeContextMenuEvent(event)
          const nextSelection = { nodeIds: [], edgeIds: [] }
          selectionController.clear()
          openMenuRef.current(position, nextSelection)
        },
        onNodeContextMenu: (event, node) => {
          const position = normalizeContextMenuEvent(event)
          const currentSelection = latestSelectionRef.current
          const nextSelection = currentSelection.nodeIds.includes(node.id)
            ? currentSelection
            : { nodeIds: [node.id], edgeIds: [] }

          if (nextSelection !== currentSelection) {
            selectionController.replace(nextSelection)
          }

          openMenuRef.current(position, nextSelection)
        },
        onEdgeContextMenu: (event, edge) => {
          const position = normalizeContextMenuEvent(event)
          const currentSelection = latestSelectionRef.current
          const nextSelection = currentSelection.edgeIds.includes(edge.id)
            ? currentSelection
            : { nodeIds: [], edgeIds: [edge.id] }

          if (nextSelection !== currentSelection) {
            selectionController.replace(nextSelection)
          }

          openMenuRef.current(position, nextSelection)
        },
      }),
      [selectionController],
    )

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
    const contributors = [...canvasContextMenuContributors, ...selectionContributors]

    const menu = menuContext
      ? buildMenu({
          context: menuContext,
          services,
          contributors,
          commands: canvasContextMenuCommands,
          groupConfig: canvasContextMenuGroupConfig,
        })
      : { groups: [], flatItems: [], isEmpty: true }

    return <ContextMenuHost ref={hostRef} menu={menu} onClose={() => setMenuContext(null)} />
  },
)

CanvasContextMenu.displayName = 'CanvasContextMenu'
