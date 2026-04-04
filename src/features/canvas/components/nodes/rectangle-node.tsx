import { ResizableNodeWrapper } from './resizable-node-wrapper'
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
  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={20}
      minHeight={20}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative flex h-[calc(100%-5px)] w-[calc(100%-5px)] items-center justify-center rounded-md border border-border shadow-sm"
          style={{
            backgroundColor: data.color,
            opacity: (data.opacity ?? 100) / 100,
          }}
        />
      </div>
    </ResizableNodeWrapper>
  )
}
