import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'

export type RectangleNodeData = { color?: string; opacity?: number }

export function RectanglePreview({ color, opacity }: { color: string; opacity?: number }) {
  const normalizedOpacity = Number.isFinite(opacity) ? Math.min(Math.max(opacity, 0), 100) : 100

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative flex h-[calc(100%_-_5px)] w-[calc(100%_-_5px)] items-center justify-center rounded-md border border-border shadow-sm"
        style={{
          backgroundColor: color,
          opacity: normalizedOpacity / 100,
        }}
      />
    </div>
  )
}

export function RectangleNode({ id, dragging, data }: NodeProps<Node<RectangleNodeData>>) {
  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="rectangle"
      dragging={!!dragging}
      minWidth={20}
      minHeight={20}
    >
      <RectanglePreview color={data.color ?? 'transparent'} opacity={data.opacity} />
    </ResizableNodeWrapper>
  )
}
