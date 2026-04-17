import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../../utils/canvas-context'
import { useNodeEditing } from '../../hooks/useNodeEditing'
import { STICKY_DEFAULT_COLOR } from './sticky-node-constants'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'

export type StickyNodeType = Node<{ label: string; color: string; opacity?: number }, 'sticky'>

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

export function StickyNode({ id, data, selected, dragging }: NodeProps<StickyNodeType>) {
  const [editValue, setEditValue] = useState('')
  const { pendingEditNodeId, setPendingEditNodeId, updateNodeData } = useContext(CanvasContext)
  const label = data.label || ''
  const color = data.color || STICKY_DEFAULT_COLOR
  const opacity = (data.opacity ?? 100) / 100

  const cancelledRef = useRef(false)
  const {
    isEditing,
    startEditing: baseStartEditing,
    handleBlur,
  } = useNodeEditing({ id, currentValue: label, updateNodeData })

  const startEditing = useCallback(() => {
    cancelledRef.current = false
    setEditValue(label)
    baseStartEditing()
  }, [label, baseStartEditing])

  useEffect(() => {
    if (!selected || isEditing || pendingEditNodeId !== id) return
    startEditing()
    setPendingEditNodeId(null)
  }, [id, isEditing, pendingEditNodeId, selected, setPendingEditNodeId, startEditing])

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
              handleBlur(editValue)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                cancelledRef.current = true
                handleBlur(label)
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                cancelledRef.current = true
                handleBlur(editValue)
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
