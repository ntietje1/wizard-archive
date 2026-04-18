import { useReactFlow } from '@xyflow/react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import {
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_OPACITY,
  STICKY_DEFAULT_WIDTH,
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
} from '../components/nodes/sticky-node-constants'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'

type PlacementNodeType = 'text' | 'sticky'

interface UseCanvasPlacementToolOptions {
  nodesMap: Y.Map<Node>
  type: PlacementNodeType
  setPendingEditNodeId: (id: string | null) => void
}

export function useCanvasPlacementTool({
  nodesMap,
  type,
  setPendingEditNodeId,
}: UseCanvasPlacementToolOptions) {
  const reactFlow = useReactFlow()

  return (event: React.MouseEvent) => {
    const id = crypto.randomUUID()
    const position = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    const width = type === 'sticky' ? STICKY_DEFAULT_WIDTH : TEXT_NODE_DEFAULT_WIDTH
    const height = type === 'sticky' ? STICKY_DEFAULT_HEIGHT : TEXT_NODE_DEFAULT_HEIGHT
    const node: Node = {
      id,
      type,
      position: {
        x: position.x - width / 2,
        y: position.y - height / 2,
      },
      width,
      height,
      selected: true,
      draggable: true,
      data: {
        label: type === 'text' ? 'New text' : '',
        ...(type === 'sticky'
          ? {
              color: STICKY_DEFAULT_COLOR,
              opacity: STICKY_DEFAULT_OPACITY,
            }
          : {}),
      },
    }

    nodesMap.set(id, node)
    setPendingEditNodeId(id)
    useCanvasToolStore.getState().completeActiveToolAction()
  }
}
