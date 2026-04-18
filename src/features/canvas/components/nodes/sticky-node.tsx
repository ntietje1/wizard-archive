import { useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { usePendingNodeEdit } from '../../hooks/usePendingNodeEdit'
import { STICKY_DEFAULT_COLOR } from './sticky-node-constants'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'
import { useCanvasRuntimeContext } from '../../hooks/canvas-runtime-context'

export type StickyNodeData = { label?: string; color?: string; opacity?: number }

export function StickyPreview({
  label,
  color,
  opacity,
}: {
  label: string
  color: string
  opacity?: number
}) {
  return (
    <div
      className="h-full w-full p-3 rounded-md shadow-lg shadow-black/20"
      style={{
        backgroundColor: color || STICKY_DEFAULT_COLOR,
        color: '#1a1a1a',
        opacity: (opacity ?? 100) / 100,
      }}
    >
      <p className="text-sm whitespace-pre-wrap select-none">{label || 'Double-click to edit'}</p>
    </div>
  )
}

export function StickyNode({ id, data, selected, dragging }: NodeProps<Node<StickyNodeData>>) {
  const [editValue, setEditValue] = useState('')
  const {
    nodeActions: { updateNodeData },
  } = useCanvasRuntimeContext()
  const label = data.label || ''
  const color = data.color || STICKY_DEFAULT_COLOR
  const opacity = (data.opacity ?? 100) / 100

  const cancelledRef = useRef(false)
  const [isEditing, setIsEditing] = useState(false)

  const startEditing = () => {
    cancelledRef.current = false
    setEditValue(label)
    setIsEditing(true)
  }

  const commitEdit = (value: string) => {
    setIsEditing(false)
    if (value !== label) {
      updateNodeData(id, { label: value })
    }
  }

  usePendingNodeEdit({ id, selected: !!selected, isEditing, startEditing })

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
            className="bg-transparent outline-none text-sm w-full h-full min-h-[80px] resize-none nowheel"
            aria-label="Sticky note text"
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            onBlur={() => {
              if (cancelledRef.current) {
                cancelledRef.current = false
                return
              }
              commitEdit(editValue)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                cancelledRef.current = true
                setIsEditing(false)
                setEditValue(label)
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                cancelledRef.current = true
                commitEdit(editValue)
              }
            }}
            autoFocus
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap select-none">
            {label || 'Double-click to edit'}
          </p>
        )}
        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      </div>
    </ResizableNodeWrapper>
  )
}
