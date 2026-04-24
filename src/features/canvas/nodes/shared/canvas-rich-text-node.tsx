import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { CanvasNodeConnectionHandles } from './canvas-node-connection-handles'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import { extractCanvasRichTextPlainText } from './canvas-rich-text-editor'
import type { CanvasRichTextPartialBlock } from './canvas-rich-text-editor'
import type { CanvasRichTextNodeData } from './canvas-rich-text-node-data'
import { CanvasFloatingFormattingToolbar } from './canvas-floating-formatting-toolbar'
import { CanvasRichTextView } from './canvas-rich-text-view'
import { useCanvasEditableNodeSession } from './use-canvas-editable-node-session'
import { useCanvasRichTextEditorSession } from './use-canvas-rich-text-editor-session'
import { getCanvasNodeSurfaceStyle } from './canvas-node-surface-style'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

interface CanvasRichTextNodeVariant {
  nodeType: 'text'
  editAriaLabel: string
  emptyAriaLabel: string
  invalidAriaLabel: string
  invalidContentLabel: string
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

function CanvasRichTextPreview({
  content,
  data,
  invalid,
  variant,
}: {
  content: Array<CanvasRichTextPartialBlock>
  data: CanvasRichTextNodeData
  invalid: boolean
  variant: Pick<
    CanvasRichTextNodeVariant,
    | 'containerClassName'
    | 'contentClassName'
    | 'textClassName'
    | 'textColor'
    | 'invalidContentLabel'
  >
}) {
  const plainText = invalid ? '' : extractCanvasRichTextPlainText(content)

  return (
    <div
      className={cn('h-full w-full overflow-hidden', variant.containerClassName)}
      style={getContainerStyle(data, variant.textColor)}
    >
      <div className={variant.contentClassName}>
        {invalid ? (
          <p className={cn(variant.textClassName, 'italic text-muted-foreground')}>
            {variant.invalidContentLabel}
          </p>
        ) : plainText ? (
          <p className={variant.textClassName}>{plainText}</p>
        ) : null}
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
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const {
    documentWriter: { patchNodeData },
    canEdit,
  } = useCanvasRuntime()
  const [isEditing, setIsEditing] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const hasInvalidContent = data.richText.kind === 'invalid'
  const content = data.richText.content
  const plainText = hasInvalidContent ? '' : extractCanvasRichTextPlainText(content)
  const ariaLabel = hasInvalidContent
    ? variant.invalidAriaLabel
    : plainText || variant.emptyAriaLabel
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canEdit && interactiveRenderMode && !hasInvalidContent,
    editing: isEditing,
    setEditing: setIsEditing,
  })

  const editorSession = useCanvasRichTextEditorSession({
    ariaLabel: variant.editAriaLabel,
    content,
    enabled: !hasInvalidContent,
    editable: editableSession.editable,
    lifecycle: editableSession.lifecycle,
    onActivated: editableSession.handleActivated,
    onPersistContent: (nextContent) => {
      patchNodeData(new Map([[id, { content: nextContent }]]))
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
          <CanvasNodeConnectionHandles />
        </>
      }
    >
      <div
        ref={wrapperRef}
        className={cn('h-full w-full overflow-hidden', variant.containerClassName)}
        style={getContainerStyle(data, variant.textColor)}
        role="group"
        aria-label={ariaLabel}
        tabIndex={interactiveRenderMode ? 0 : -1}
        onDoubleClick={
          interactiveRenderMode && !hasInvalidContent
            ? (event) => {
                event.preventDefault()
                event.stopPropagation()
                editableSession.handleDoubleClick(event)
              }
            : undefined
        }
        onKeyDown={
          interactiveRenderMode && !hasInvalidContent
            ? (event) => {
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
              }
            : undefined
        }
      >
        <div
          className={cn(
            'h-full',
            editableSession.editable && 'nodrag nopan',
            interactiveRenderMode && editableSession.isExclusivelySelected && 'nowheel',
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
              <CanvasRichTextPreview
                content={content}
                data={data}
                invalid={hasInvalidContent}
                variant={variant}
              />
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
