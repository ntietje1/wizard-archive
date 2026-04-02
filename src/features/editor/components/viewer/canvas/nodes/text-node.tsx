import { useCallback, useContext, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../canvas-context'
import type { NodeProps } from '@xyflow/react'

export function TextNode({ id, data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const shouldCommitRef = useRef(true)
  const { updateNodeData, remoteHighlights } = useContext(CanvasContext)
  const label = (data.label as string) || 'Text'
  const highlight = remoteHighlights.get(id)

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
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            border: `2px solid ${highlight?.color ?? 'var(--primary)'}`,
          }}
        />
      )}
      <div
        className="px-4 py-2 rounded-lg border bg-background shadow-sm min-w-[120px]"
        tabIndex={0}
        onDoubleClick={() => setIsEditing(true)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'F2') && !isEditing) {
            e.preventDefault()
            setIsEditing(true)
          }
        }}
      >
        <Handle type="target" position={Position.Top} className="!bg-primary" />
        {isEditing ? (
          <input
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Text node content"
            defaultValue={label}
            onBlur={(e) => {
              if (shouldCommitRef.current) commitEdit(e.currentTarget.value)
              shouldCommitRef.current = true
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                shouldCommitRef.current = false
                setIsEditing(false)
              }
            }}
            autoFocus
          />
        ) : (
          <p className="text-sm select-none">{label}</p>
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
