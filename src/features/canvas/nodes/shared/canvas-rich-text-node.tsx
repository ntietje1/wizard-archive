import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { CanvasNodeConnectionHandles } from './canvas-node-connection-handles'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import {
  extractCanvasRichTextPlainText,
  normalizeCanvasRichTextContent,
} from './canvas-rich-text-editor'
import type { CanvasRichTextPartialBlock } from './canvas-rich-text-editor'
import { CanvasFloatingFormattingToolbar } from './canvas-floating-formatting-toolbar'
import { CanvasRichTextView } from './canvas-rich-text-view'
import { useCanvasEditableNodeSession } from './use-canvas-editable-node-session'
import { useCanvasRichTextEditorSession } from './use-canvas-rich-text-editor-session'
import { getCanvasNodeSurfaceStyle } from './canvas-node-surface-style'
import type { CanvasNodeSurfaceStyleData } from './canvas-node-surface-style'
import {
  useCanvasNodeActionsContext,
  useCanvasPermissionsContext,
} from '../../runtime/providers/canvas-runtime-hooks'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

export interface CanvasRichTextNodeData
  extends Record<string, unknown>, CanvasNodeSurfaceStyleData {
  content?: Array<CanvasRichTextPartialBlock>
}

interface CanvasRichTextNodeVariant {
  nodeType: 'text'
  editAriaLabel: string
  emptyAriaLabel: string
  minWidth: number
  minHeight: number
  containerClassName: string
  contentClassName: string
  textClassName: string
  textColor: string
}

interface CanvasRichTextNodeComponentProps extends NodeProps<Node<CanvasRichTextNodeData>> {
  variant: CanvasRichTextNodeVariant
}

export function CanvasRichTextPreview({
  data,
  variant,
}: {
  data: CanvasRichTextNodeData
  variant: Pick<
    CanvasRichTextNodeVariant,
    'containerClassName' | 'contentClassName' | 'textClassName' | 'textColor' | 'emptyAriaLabel'
  >
}) {
  const content = normalizeCanvasRichTextContent(data.content)
  const plainText = extractCanvasRichTextPlainText(content)

  return (
    <div
      className={cn('h-full w-full overflow-hidden', variant.containerClassName)}
      style={getContainerStyle(data, variant.textColor)}
    >
      <div className={variant.contentClassName}>
        {plainText ? <p className={variant.textClassName}>{plainText}</p> : null}
      </div>
    </div>
  )
}

export function CanvasRichTextNode({
  id,
  data,
  dragging,
  variant,
}: CanvasRichTextNodeComponentProps) {
  const { updateNodeData } = useCanvasNodeActionsContext()
  const canEdit = useCanvasPermissionsContext()
  const [isEditing, setIsEditing] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const content = normalizeCanvasRichTextContent(data.content)
  const plainText = extractCanvasRichTextPlainText(content)
  const ariaLabel = plainText || variant.emptyAriaLabel
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit,
    editing: isEditing,
    setEditing: setIsEditing,
  })

  const editorSession = useCanvasRichTextEditorSession({
    ariaLabel: variant.editAriaLabel,
    content,
    editable: editableSession.editable,
    lifecycle: editableSession.lifecycle,
    onActivated: editableSession.handleActivated,
    onPersistContent: (nextContent) => {
      updateNodeData(id, { content: nextContent })
    },
  })
  const showsFormattingToolbar = editableSession.editable && editorSession.editor !== null

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType={variant.nodeType}
      dragging={!!dragging}
      minWidth={variant.minWidth}
      minHeight={variant.minHeight}
      editing={editableSession.editable}
      chrome={
        <>
          <CanvasFloatingFormattingToolbar
            editor={editorSession.editor}
            visible={showsFormattingToolbar}
          />
          <CanvasNodeConnectionHandles selected={editableSession.isSelected} />
        </>
      }
    >
      <div
        ref={wrapperRef}
        className={cn('h-full w-full overflow-hidden', variant.containerClassName)}
        style={getContainerStyle(data, variant.textColor)}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          editableSession.handleDoubleClick(event)
        }}
        onKeyDown={(event) => {
          if (!editableSession.editable && (event.key === 'Enter' || event.key === 'F2')) {
            event.preventDefault()
            event.stopPropagation()
            editableSession.startEditing()
            return
          }

          if (editableSession.editable && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            editableSession.stopEditing()
            wrapperRef.current?.focus()
          }
        }}
      >
        <div
          className={cn(
            'h-full',
            editableSession.editable && 'nodrag nopan',
            editableSession.isExclusivelySelected && 'nowheel',
          )}
        >
          <ScrollArea viewportRef={editorSession.viewportRef} className="h-full">
            {editorSession.editor ? (
              <div className={cn('h-full w-full', variant.contentClassName, variant.textClassName)}>
                <CanvasRichTextView
                  editor={editorSession.editor}
                  editable={editableSession.editable}
                  className={cn(
                    'h-full w-full bg-transparent',
                    '[&_.bn-container]:h-full [&_.bn-container]:bg-transparent',
                    '[&_.bn-editor]:h-full [&_.bn-editor]:bg-transparent',
                    '[&_.bn-editor]:outline-none [&_.bn-editor]:px-0 [&_.bn-editor]:py-0',
                  )}
                />
              </div>
            ) : (
              <CanvasRichTextPreview data={data} variant={variant} />
            )}
          </ScrollArea>
        </div>
      </div>
    </ResizableNodeWrapper>
  )
}

function getContainerStyle(data: CanvasRichTextNodeData, textColor: string): CSSProperties {
  return {
    ...getCanvasNodeSurfaceStyle(data),
    color: textColor,
  }
}
