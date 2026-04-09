import { useNodes } from '@xyflow/react'
import { useMemo } from 'react'
import { NameLabel } from './canvas-remote-cursors'
import type { RemoteUser } from '../utils/canvas-awareness-types'

const DEFAULT_NODE_WIDTH = 150
const DEFAULT_NODE_HEIGHT = 40
const HIGHLIGHT_PADDING = 4
const HIGHLIGHT_Z_INDEX = 999
const LABEL_OFFSET_TOP = -22
const LABEL_OFFSET_LEFT = -2

type HighlightRect = {
  key: string
  x: number
  y: number
  width: number
  height: number
  color: string
  name: string | null
}

export function CanvasRemoteSelections({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const nodes = useNodes()

  const rects = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const result: Array<HighlightRect> = []

    for (const remoteUser of remoteUsers) {
      const draggedIds = remoteUser.dragging ? new Set(Object.keys(remoteUser.dragging)) : null
      const resizedIds = remoteUser.resizing ? new Set(Object.keys(remoteUser.resizing)) : null
      const showNameOnDrag = draggedIds && draggedIds.size > 0
      const showNameOnResize = !showNameOnDrag && resizedIds && resizedIds.size > 0

      if (draggedIds) {
        let first = true
        for (const nodeId of draggedIds) {
          const node = nodeById.get(nodeId)
          if (!node) continue
          result.push({
            key: `${remoteUser.clientId}-drag-${nodeId}`,
            x: node.position.x,
            y: node.position.y,
            width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
            height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
            color: remoteUser.user.color,
            name: first ? remoteUser.user.name : null,
          })
          first = false
        }
      }

      if (resizedIds && remoteUser.resizing) {
        let first = true
        for (const nodeId of resizedIds) {
          if (draggedIds?.has(nodeId)) continue
          const dims = remoteUser.resizing[nodeId]
          result.push({
            key: `${remoteUser.clientId}-resize-${nodeId}`,
            x: dims.x,
            y: dims.y,
            width: dims.width,
            height: dims.height,
            color: remoteUser.user.color,
            name: first && showNameOnResize ? remoteUser.user.name : null,
          })
          first = false
        }
      }

      if (remoteUser.selectedNodeIds) {
        let firstSelected = true
        for (const nodeId of remoteUser.selectedNodeIds) {
          if (draggedIds?.has(nodeId)) continue
          if (resizedIds?.has(nodeId)) continue
          const node = nodeById.get(nodeId)
          if (!node) continue
          result.push({
            key: `${remoteUser.clientId}-sel-${nodeId}`,
            x: node.position.x,
            y: node.position.y,
            width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
            height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
            color: remoteUser.user.color,
            name:
              !showNameOnDrag && !showNameOnResize && firstSelected ? remoteUser.user.name : null,
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
            zIndex: HIGHLIGHT_Z_INDEX,
          }}
        >
          {rect.name && (
            <div
              style={{
                position: 'absolute',
                top: LABEL_OFFSET_TOP,
                left: LABEL_OFFSET_LEFT,
              }}
            >
              <NameLabel name={rect.name} color={rect.color} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
