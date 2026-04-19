import { useEffect, useRef } from 'react'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import { useInlineCanvasNodeEdit } from '../shared/use-inline-canvas-node-edit'
import type { Node, NodeProps } from '@xyflow/react'
import { useCanvasNodeActionsContext } from '../../runtime/providers/canvas-runtime-context'

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
  const { updateNodeData } = useCanvasNodeActionsContext()
  const trimmedLabel = typeof data.label === 'string' ? data.label.trim() : ''
  const hasLabel = trimmedLabel.length > 0
  const label = hasLabel ? trimmedLabel : 'Text'
  const ariaLabel = hasLabel ? `${trimmedLabel} node` : 'Empty text node'
  const inputRef = useRef<HTMLInputElement>(null)
  const { isEditing, editValue, setEditValue, startEditing, handleBlur, handleInputKeyDown } =
    useInlineCanvasNodeEdit<HTMLInputElement>({
      id,
      selected: !!selected,
      value: trimmedLabel,
      onCommit: (nextValue) => {
        updateNodeData(id, { label: nextValue.trim() })
      },
      shouldCommit: (event) => event.key === 'Enter' && !event.shiftKey,
      shouldCancel: (event) => event.key === 'Escape',
    })

  useEffect(() => {
    if (!isEditing) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="text"
      selected={!!selected}
      dragging={!!dragging}
      minWidth={80}
      minHeight={30}
    >
      <div
        className={TEXT_CONTAINER_CLASS}
        role="group"
        aria-label={ariaLabel}
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
        <CanvasNodeConnectionHandles selected={!!selected} />
        {isEditing ? (
          <input
            ref={inputRef}
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Text node content"
            placeholder="Text"
            value={editValue}
            onChange={(event) => setEditValue(event.currentTarget.value)}
            onBlur={handleBlur}
            onKeyDown={handleInputKeyDown}
          />
        ) : (
          <p className="text-sm select-none">{label}</p>
        )}
      </div>
    </ResizableNodeWrapper>
  )
}
