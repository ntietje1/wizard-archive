import { useEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { CanvasNodeConnectionHandles } from './canvas-node-connection-handles'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import { extractCanvasTextPlainText } from '../../text/editor'
import type { CanvasTextPartialBlock } from '../../text/schema'
import type { CanvasTextNodeRenderData } from '../../text/node-data'
import { CanvasFloatingFormattingToolbar } from './canvas-floating-formatting-toolbar'
import { registerCanvasTextFormattingSession } from '../../text/formatting-session'
import { CanvasTextView } from '../../text/view'
import { useCanvasEditableNodeSession } from './use-canvas-editable-node-session'
import { useCanvasTextEditorSession } from '../../text/editor-session'
import {
  getCanvasNodeDefaultTextColor,
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../../node-surface-style'
import {
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../../runtime/providers/canvas-runtime'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { CanvasNodeComponentProps } from '../canvas-node-types'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'

interface CanvasTextNodeVariant {
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
}

interface CanvasTextNodeComponentProps extends Omit<CanvasNodeComponentProps<'text'>, 'data'> {
  data: CanvasTextNodeRenderData
  variant: CanvasTextNodeVariant
}

type CanvasTextEditableSession = ReturnType<typeof useCanvasEditableNodeSession>
type CanvasTextEditorSession = ReturnType<typeof useCanvasTextEditorSession>

function persistCanvasTextDefaultTextColor(
  patchNodeData: CanvasDocumentWriter['patchNodeData'],
  id: string,
  textColor: string,
) {
  patchNodeData(new Map([[id, { textColor }]]))
}

function CanvasTextPreview({
  content,
  invalid,
  variant,
}: {
  content: Array<CanvasTextPartialBlock>
  invalid: boolean
  variant: Pick<CanvasTextNodeVariant, 'contentClassName' | 'textClassName' | 'invalidContentLabel'>
}) {
  const plainText = invalid ? '' : extractCanvasTextPlainText(content)

  return (
    <div className="h-full w-full overflow-hidden">
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

export function CanvasTextNode({ id, data, dragging, variant }: CanvasTextNodeComponentProps) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const { documentWriter } = useCanvasDocumentRuntime()
  const { canEdit } = useCanvasInteractionRuntime()
  const { domRuntime } = useCanvasViewportRuntime()
  const { patchNodeData } = documentWriter
  const [isEditing, setIsEditing] = useState(false)
  const [surfaceElement, setSurfaceElement] = useState<HTMLElement | null>(null)
  const hasInvalidContent = data.text.kind === 'invalid'
  const content = data.text.content
  const plainText = hasInvalidContent ? '' : extractCanvasTextPlainText(content)
  const ariaLabel = hasInvalidContent
    ? variant.invalidAriaLabel
    : plainText || variant.emptyAriaLabel
  const canActivateNode = canEdit && interactiveRenderMode && !hasInvalidContent
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canActivateNode,
    editing: isEditing,
    setEditing: setIsEditing,
  })

  const editorSession = useCanvasTextEditorSession({
    ariaLabel: variant.editAriaLabel,
    content,
    enabled: !hasInvalidContent,
    editable: editableSession.editable,
    onActivated: editableSession.handleActivated,
    pendingActivationRef: editableSession.pendingActivationRef,
    onPersistContent: (nextContent) => {
      patchNodeData(new Map([[id, { content: nextContent }]]))
    },
  })
  const showsFormattingToolbar = editableSession.editable && editorSession.editor !== null
  const defaultTextColor = getCanvasNodeDefaultTextColor(data)

  useEffect(
    () => domRuntime.registerNodeSurfaceElement(id, surfaceElement),
    [domRuntime, id, surfaceElement],
  )

  useEffect(() => {
    if (!showsFormattingToolbar || !editorSession.editor) {
      return
    }

    return registerCanvasTextFormattingSession({
      nodeId: id,
      editor: editorSession.editor,
      defaultTextColor,
      setDefaultTextColor: (textColor) => {
        persistCanvasTextDefaultTextColor(patchNodeData, id, textColor)
      },
    })
  }, [defaultTextColor, editorSession.editor, id, patchNodeData, showsFormattingToolbar])

  return (
    <CanvasTextNodeSurface
      ariaLabel={ariaLabel}
      canActivateNode={canActivateNode}
      content={content}
      data={data}
      defaultTextColor={defaultTextColor}
      dragging={!!dragging}
      editableSession={editableSession}
      editorSession={editorSession}
      hasInvalidContent={hasInvalidContent}
      id={id}
      interactiveRenderMode={interactiveRenderMode}
      onDefaultTextColorChange={(textColor) => {
        persistCanvasTextDefaultTextColor(patchNodeData, id, textColor)
      }}
      showsFormattingToolbar={showsFormattingToolbar}
      setSurfaceElement={setSurfaceElement}
      variant={variant}
    />
  )
}

function CanvasTextNodeSurface({
  ariaLabel,
  canActivateNode,
  content,
  data,
  defaultTextColor,
  dragging,
  editableSession,
  editorSession,
  hasInvalidContent,
  id,
  interactiveRenderMode,
  onDefaultTextColorChange,
  showsFormattingToolbar,
  setSurfaceElement,
  variant,
}: {
  ariaLabel: string
  canActivateNode: boolean
  content: Array<CanvasTextPartialBlock>
  data: CanvasTextNodeRenderData
  defaultTextColor: string
  dragging: boolean
  editableSession: CanvasTextEditableSession
  editorSession: CanvasTextEditorSession
  hasInvalidContent: boolean
  id: string
  interactiveRenderMode: boolean
  onDefaultTextColorChange: (textColor: string) => void
  showsFormattingToolbar: boolean
  setSurfaceElement: (element: HTMLElement | null) => void
  variant: CanvasTextNodeVariant
}) {
  return (
    <ResizableNodeWrapper
      id={id}
      nodeType={variant.nodeType}
      dragging={dragging}
      minWidth={variant.minWidth}
      minHeight={variant.minHeight}
      editing={editableSession.editable}
      chrome={
        <>
          <CanvasFloatingFormattingToolbar
            defaultTextColor={defaultTextColor}
            editor={editorSession.editor}
            onDefaultTextColorChange={onDefaultTextColorChange}
            visible={showsFormattingToolbar}
          />
          <CanvasNodeConnectionHandles />
        </>
      }
    >
      <div
        ref={setSurfaceElement}
        className={cn('h-full w-full overflow-hidden', variant.containerClassName)}
        style={getContainerStyle(data)}
        role={canActivateNode ? 'textbox' : undefined}
        aria-label={ariaLabel}
        aria-multiline={canActivateNode ? 'true' : undefined}
        tabIndex={canActivateNode ? 0 : undefined}
        onDoubleClick={
          canActivateNode
            ? (event) => handleCanvasTextSurfaceDoubleClick(event, editableSession)
            : undefined
        }
        onKeyDownCapture={
          canActivateNode
            ? (event) => handleCanvasTextSurfaceKeyDownCapture(event, editableSession)
            : undefined
        }
        onKeyDown={
          canActivateNode
            ? (event) => {
                handleCanvasTextSurfaceKeyDown(event, editableSession)
              }
            : undefined
        }
      >
        <div
          className={cn(
            'h-full',
            editableSession.editable ? 'select-text' : 'select-none',
            editableSession.editable && 'nodrag nopan',
            interactiveRenderMode && editableSession.isExclusivelySelected && 'nowheel',
          )}
        >
          <ScrollArea viewportRef={editorSession.viewportRef} className="h-full">
            {editorSession.editor && !hasInvalidContent ? (
              <div className={cn('h-full w-full', variant.contentClassName, variant.textClassName)}>
                <CanvasTextView
                  editor={editorSession.editor}
                  editable={editableSession.editable}
                  className={cn(
                    'h-full w-full bg-transparent',
                    '[&_.bn-container]:h-full [&_.bn-container]:bg-transparent',
                    '[&_.bn-editor]:h-full [&_.bn-editor]:bg-transparent',
                    '[&_.bn-editor]:outline-none [&_.bn-editor]:px-0 [&_.bn-editor]:py-0',
                  )}
                  style={getCanvasNodeTextStyle(data)}
                />
              </div>
            ) : (
              <CanvasTextPreview content={content} invalid={hasInvalidContent} variant={variant} />
            )}
          </ScrollArea>
        </div>
      </div>
    </ResizableNodeWrapper>
  )
}

function handleCanvasTextSurfaceDoubleClick(
  event: MouseEvent<HTMLDivElement>,
  editableSession: CanvasTextEditableSession,
) {
  event.preventDefault()
  event.stopPropagation()
  editableSession.handleDoubleClick(event)
}

function handleCanvasTextSurfaceKeyDownCapture(
  event: KeyboardEvent<HTMLDivElement>,
  editableSession: CanvasTextEditableSession,
) {
  if (!editableSession.editing || event.key !== 'Escape') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  editableSession.stopEditing()
  event.currentTarget.focus()
}

function handleCanvasTextSurfaceKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  editableSession: CanvasTextEditableSession,
) {
  if (!editableSession.editable && (event.key === 'Enter' || event.key === 'F2')) {
    event.preventDefault()
    event.stopPropagation()
    editableSession.startEditing()
    return
  }
}

function getContainerStyle(data: CanvasTextNodeRenderData): CSSProperties {
  return {
    ...getCanvasNodeSurfaceStyle(data),
    ...getCanvasNodeTextStyle(data),
  }
}
