import { useContext, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CanvasContext } from '../../utils/canvas-context'
import { useNodeEditing } from '../../hooks/useNodeEditing'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { NodeProps } from '@xyflow/react'

const TEXT_CONTAINER_CLASS = 'px-4 py-2 rounded-lg border bg-background shadow-sm h-full w-full'

export function TextPreview({ label }: { label: string }) {
  return (
    <div className={TEXT_CONTAINER_CLASS}>
      <p className="text-sm select-none">{label || 'Text'}</p>
    </div>
  )
}

export function TextNode({ id, data, selected, dragging }: NodeProps) {
  const { pendingEditNodeId, setPendingEditNodeId, updateNodeData } = useContext(CanvasContext)
  const label = (data.label as string) || 'Text'

  const { isEditing, startEditing, handleBlur, handleKeyDown, containerKeyDown } = useNodeEditing({
    id,
    currentValue: label,
    updateNodeData,
  })

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
      minWidth={80}
      minHeight={30}
    >
      <div
        className={TEXT_CONTAINER_CLASS}
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
        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      </div>
    </ResizableNodeWrapper>
  )
}
