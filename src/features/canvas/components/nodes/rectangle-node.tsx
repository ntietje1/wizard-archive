import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'

export type RectangleNodeType = Node<
  { color: string; opacity?: number },
  'rectangle'
>

export function RectanglePreview({
  color,
  opacity,
}: {
  color: string
  opacity?: number
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative flex h-[calc(100%_-_5px)] w-[calc(100%_-_5px)] items-center justify-center rounded-md border border-border shadow-sm"
        style={{
          backgroundColor: color,
          opacity: Math.min(Math.max(opacity ?? 100, 0), 100) / 100,
        }}
      />
    </div>
  )
}

export function RectangleNode({
  id,
  selected,
  dragging,
  data,
}: NodeProps<RectangleNodeType>) {
  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={20}
      minHeight={20}
    >
      <RectanglePreview color={data.color} opacity={data.opacity} />
    </ResizableNodeWrapper>
  )
}
