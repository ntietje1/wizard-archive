import { useNodes } from '@xyflow/react'
import { useMemo } from 'react'
import { NameLabel } from './canvas-remote-cursors'
import type { RemoteUser } from '../utils/canvas-awareness-types'

const DEFAULT_NODE_WIDTH = 150
const DEFAULT_NODE_HEIGHT = 40
const HIGHLIGHT_PADDING = 4

type HighlightRect = {
  key: string
  x: number
  y: number
  width: number
  height: number
  color: string
  name: string | null
}

export function CanvasRemoteSelections({
  remoteUsers,
}: {
  remoteUsers: Array<RemoteUser>
}) {
  const nodes = useNodes()

  const rects = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const result: Array<HighlightRect> = []

    for (const user of remoteUsers) {
      const draggedIds = user.dragging
        ? new Set(Object.keys(user.dragging))
        : null
      const showNameOnDrag = draggedIds && draggedIds.size > 0

      if (draggedIds) {
        let first = true
        for (const nodeId of draggedIds) {
          const node = nodeById.get(nodeId)
          if (!node) continue
          result.push({
            key: `${user.clientId}-drag-${nodeId}`,
            x: node.position.x,
            y: node.position.y,
            width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
            height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
            color: user.user.color,
            name: first ? user.user.name : null,
          })
          first = false
        }
      }

      if (user.selectedNodeIds) {
        let firstSelected = true
        for (const nodeId of user.selectedNodeIds) {
          if (draggedIds?.has(nodeId)) continue
          const node = nodeById.get(nodeId)
          if (!node) continue
          result.push({
            key: `${user.clientId}-sel-${nodeId}`,
            x: node.position.x,
            y: node.position.y,
            width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
            height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
            color: user.user.color,
            name: !showNameOnDrag && firstSelected ? user.user.name : null,
          })
          firstSelected = false
        }
      }
    }

    return result
  }, [nodes, remoteUsers])

  return (
    <>
      {rects.map((rect) => (
        <div
          key={rect.key}
          style={{
            position: 'absolute',
            left: rect.x - HIGHLIGHT_PADDING,
            top: rect.y - HIGHLIGHT_PADDING,
            width: rect.width + HIGHLIGHT_PADDING * 2,
            height: rect.height + HIGHLIGHT_PADDING * 2,
            border: `2px solid ${rect.color}`,
            borderRadius: 6,
            pointerEvents: 'none',
            zIndex: 999,
          }}
        >
          {rect.name && (
            <div style={{ position: 'absolute', top: -22, left: -2 }}>
              <NameLabel name={rect.name} color={rect.color} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
