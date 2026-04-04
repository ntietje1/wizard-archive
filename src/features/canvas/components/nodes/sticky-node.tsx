import { useCallback, useContext, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../../utils/canvas-context'
import { useNodeEditing } from '../../hooks/useNodeEditing'
import { STICKY_DEFAULT_COLOR } from './sticky-node-constants'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'

export type StickyNodeType = Node<
  { label: string; color: string; opacity?: number },
  'sticky'
>

export function StickyNode({
  id,
  data,
  selected,
  dragging,
}: NodeProps<StickyNodeType>) {
  const [editValue, setEditValue] = useState('')
  const { updateNodeData } = useContext(CanvasContext)
  const label = data.label || ''
  const color = data.color || STICKY_DEFAULT_COLOR
  const opacity = (data.opacity ?? 100) / 100

  const {
    isEditing,
    startEditing: baseStartEditing,
    handleBlur,
  } = useNodeEditing({ id, currentValue: label, updateNodeData })

  const startEditing = useCallback(() => {
    setEditValue(label)
    baseStartEditing()
  }, [label, baseStartEditing])

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={100}
      minHeight={100}
    >
      <div
        className="h-full w-full p-3 rounded-md shadow-lg shadow-black/20"
        style={{ backgroundColor: color, color: '#1a1a1a', opacity }}
        role="group"
        aria-label={label || 'Empty sticky note'}
        tabIndex={0}
        onDoubleClick={startEditing}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'F2') && !isEditing) {
            e.preventDefault()
            startEditing()
          }
        }}
      >
        <Handle type="target" position={Position.Top} className="!bg-primary" />
        {isEditing ? (
          <textarea
            className="bg-transparent outline-none text-sm w-full h-full min-h-[80px] resize-none"
            aria-label="Sticky note text"
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            onBlur={() => handleBlur(editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleBlur(label)
              }
            }}
            autoFocus
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap select-none">
            {label || 'Double-click to edit'}
          </p>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary"
        />
      </div>
    </ResizableNodeWrapper>
  )
}
