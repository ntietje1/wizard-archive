import { Handle, Position } from '@xyflow/react'
import { STICKY_DEFAULT_COLOR } from './sticky-node-constants'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { useInlineCanvasNodeEdit } from '../shared/use-inline-canvas-node-edit'
import type { Node, NodeProps } from '@xyflow/react'
import { useCanvasNodeActionsContext } from '../../runtime/providers/canvas-runtime-context'

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
  const { updateNodeData } = useCanvasNodeActionsContext()
  const label = data.label || ''
  const color = data.color || STICKY_DEFAULT_COLOR
  const opacity = (data.opacity ?? 100) / 100

  const { isEditing, editValue, setEditValue, startEditing, handleBlur, handleInputKeyDown } =
    useInlineCanvasNodeEdit<HTMLTextAreaElement>({
      id,
      selected: !!selected,
      value: label,
      onCommit: (nextValue) => updateNodeData(id, { label: nextValue }),
      shouldCommit: (event) => event.key === 'Enter' && (event.metaKey || event.ctrlKey),
      shouldCancel: (event) => event.key === 'Escape',
    })

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
            onBlur={handleBlur}
            onKeyDown={handleInputKeyDown}
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
