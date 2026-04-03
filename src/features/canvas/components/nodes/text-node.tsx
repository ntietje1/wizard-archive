import { useContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../../utils/canvas-context'
import { useNodeEditing } from '../../hooks/useNodeEditing'
import type { NodeProps } from '@xyflow/react'

export function TextNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, remoteHighlights } = useContext(CanvasContext)
  const label = (data.label as string) || 'Text'
  const highlight = remoteHighlights.get(id)

  const {
    isEditing,
    startEditing,
    handleBlur,
    handleKeyDown,
    containerKeyDown,
  } = useNodeEditing({ id, currentValue: label, updateNodeData })

  return (
    <div className="relative">
      {(selected || highlight) && (
        <div
          className="absolute -inset-0.5 rounded-lg pointer-events-none"
          style={{
            border: `1px solid ${highlight?.color ?? 'var(--primary)'}`,
          }}
        />
      )}
      <div
        className="px-4 py-2 rounded-lg border bg-background shadow-sm min-w-[120px]"
        tabIndex={0}
        onDoubleClick={startEditing}
        onKeyDown={containerKeyDown}
      >
        <Handle type="target" position={Position.Top} className="!bg-primary" />
        {isEditing ? (
          <input
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Text node content"
            defaultValue={label}
            onBlur={(e) => handleBlur(e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(e, e.currentTarget.value)}
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
