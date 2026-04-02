import { useCallback, useContext, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../canvas-context'
import { STICKY_COLORS } from './stick-node-colors'
import type { NodeProps } from '@xyflow/react'

export function StickyNode({ id, data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { updateNodeData } = useContext(CanvasContext)
  const label = (data.label as string) || ''
  const colorIndex = (data.colorIndex as number) ?? 0
  const colorClass = STICKY_COLORS[colorIndex] ?? STICKY_COLORS[0]

  const commitEdit = useCallback(
    (value: string) => {
      setIsEditing(false)
      if (value !== label) updateNodeData(id, { label: value })
    },
    [id, label, updateNodeData],
  )

  return (
    <div
      className={`${colorClass} w-[200px] min-h-[120px] p-3 rounded-md shadow-md ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
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
        <textarea
          className="bg-transparent outline-none text-sm w-full h-full min-h-[80px] resize-none"
          aria-label="Sticky note text"
          defaultValue={label}
          onBlur={(e) => commitEdit(e.currentTarget.value)}
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
  )
}
