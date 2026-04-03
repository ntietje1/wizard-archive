import { useCallback, useContext, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../canvas-context'
import { STICKY_COLORS } from './sticky-node-colors'
import type { Node, NodeProps } from '@xyflow/react'

export type StickyNodeType = Node<
  { label: string; color: string; opacity?: number },
  'sticky'
>

export function StickyNode({ id, data, selected }: NodeProps<StickyNodeType>) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const shouldCommitRef = useRef(true)
  const { updateNodeData, remoteHighlights } = useContext(CanvasContext)
  const label = data.label || ''
  const color = data.color || STICKY_COLORS[0]
  const opacity = (data.opacity ?? 100) / 100
  const highlight = remoteHighlights.get(id)

  const startEditing = useCallback(() => {
    setEditValue(label)
    setIsEditing(true)
  }, [label])

  const commitEdit = useCallback(
    (value: string) => {
      setIsEditing(false)
      if (value !== label) updateNodeData(id, { label: value })
    },
    [id, label, updateNodeData],
  )

  return (
    <div className="relative">
      {(selected || highlight) && (
        <div
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{
            border: `2px solid ${highlight?.color ?? 'var(--primary)'}`,
          }}
        />
      )}
      <div
        className="w-[200px] min-h-[120px] p-3 rounded-md shadow-md"
        style={{ backgroundColor: color, opacity }}
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
            onBlur={() => {
              if (shouldCommitRef.current) commitEdit(editValue)
              else setIsEditing(false)
              shouldCommitRef.current = true
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                shouldCommitRef.current = false
                e.currentTarget.blur()
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
    </div>
  )
}
