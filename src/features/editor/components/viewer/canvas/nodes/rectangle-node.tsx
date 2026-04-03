import { useContext, useState } from 'react'
import { NodeResizer, NodeToolbar, useOnSelectionChange } from '@xyflow/react'
import { CanvasContext } from '../canvas-context'
import type { Node, NodeProps } from '@xyflow/react'

export type RectangleNodeType = Node<{ color: string }, 'rectangle'>

const COLOR_OPTIONS = [
  'var(--muted)',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
]

export function RectangleNode({
  id,
  selected,
  dragging,
  data,
}: NodeProps<RectangleNodeType>) {
  const color = data.color
  const { updateNodeData, remoteHighlights } = useContext(CanvasContext)
  const highlight = remoteHighlights.get(id)

  const [multipleSelected, setMultipleSelected] = useState(false)
  useOnSelectionChange({
    onChange: ({ nodes }: { nodes: Array<Node> }) =>
      setMultipleSelected(nodes.length > 1),
  })

  return (
    <>
      <NodeResizer isVisible={!!selected && !dragging} />
      <NodeToolbar
        isVisible={!!selected && !dragging && !multipleSelected}
        className="nopan"
      >
        <div className="flex gap-1 rounded-lg border bg-background p-2 shadow-lg">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                outline: color === c ? '2px solid var(--primary)' : 'none',
                outlineOffset: '2px',
              }}
              onClick={() => updateNodeData(id, { color: c })}
            />
          ))}
        </div>
      </NodeToolbar>
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative flex h-[calc(100%-5px)] w-[calc(100%-5px)] items-center justify-center rounded-md border border-border shadow-sm"
          style={{
            backgroundColor: color,
            outline:
              selected || highlight
                ? `2px solid ${highlight?.color ?? 'var(--primary)'}`
                : 'none',
            outlineOffset: '2px',
          }}
        />
      </div>
    </>
  )
}
