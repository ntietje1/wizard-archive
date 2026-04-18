import { useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { usePendingNodeEdit } from '../../hooks/usePendingNodeEdit'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'
import { useCanvasRuntimeContext } from '../../hooks/canvas-runtime-context'

const TEXT_CONTAINER_CLASS = 'px-4 py-2 rounded-lg border bg-background shadow-sm h-full w-full'

export type TextNodeData = { label?: string }

export function TextPreview({ label }: { label: string }) {
  return (
    <div className={TEXT_CONTAINER_CLASS}>
      <p className="text-sm select-none">{label || 'Text'}</p>
    </div>
  )
}

export function TextNode({ id, data, selected, dragging }: NodeProps<Node<TextNodeData>>) {
  const {
    nodeActions: { updateNodeData },
  } = useCanvasRuntimeContext()
  const label = (data.label as string) || 'Text'
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)
  const commitBlockedRef = useRef(false)

  const startEditing = () => {
    commitBlockedRef.current = false
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
      minWidth={80}
      minHeight={30}
    >
      <div
        className={TEXT_CONTAINER_CLASS}
        tabIndex={0}
        onDoubleClick={startEditing}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === 'F2') && !isEditing) {
            event.preventDefault()
            event.stopPropagation()
            startEditing()
          }
        }}
      >
        <Handle type="target" position={Position.Top} className="!bg-primary" />
        {isEditing ? (
          <input
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Text node content"
            value={editValue}
            onChange={(event) => setEditValue(event.currentTarget.value)}
            onBlur={(event) => {
              if (commitBlockedRef.current) {
                commitBlockedRef.current = false
                return
              }
              commitEdit(event.currentTarget.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.stopPropagation()
                commitBlockedRef.current = true
                commitEdit(editValue)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                commitBlockedRef.current = true
                setIsEditing(false)
                setEditValue(label)
              }
            }}
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
