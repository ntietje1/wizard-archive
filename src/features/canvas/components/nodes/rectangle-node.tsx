import { useContext } from 'react'
import { NodeResizer } from '@xyflow/react'
import { CanvasContext } from '../../utils/canvas-context'
import type { Node, NodeProps } from '@xyflow/react'

export type RectangleNodeType = Node<
  { color: string; opacity?: number },
  'rectangle'
>

export function RectangleNode({
  id,
  selected,
  dragging,
  data,
}: NodeProps<RectangleNodeType>) {
  const { remoteHighlights } = useContext(CanvasContext)
  const highlight = remoteHighlights.get(id)

  return (
    <>
      <NodeResizer isVisible={!!selected && !dragging} />
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative flex h-[calc(100%-5px)] w-[calc(100%-5px)] items-center justify-center rounded-md border border-border shadow-sm"
          style={{
            backgroundColor: data.color,
            opacity: (data.opacity ?? 100) / 100,
            outline:
              selected || highlight
                ? `1px solid ${highlight?.color ?? 'var(--primary)'}`
                : 'none',
            outlineOffset: '1px',
          }}
        />
      </div>
    </>
  )
}
