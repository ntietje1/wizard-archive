import { BlockNoteEditor } from '@blocknote/core'
import { useReactFlow } from '@xyflow/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { CanvasNodeConnectionHandles } from './canvas-node-connection-handles'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import {
  canvasRichTextEditorSchema,
  cloneCanvasRichTextContent,
  extractCanvasRichTextPlainText,
  normalizeCanvasRichTextContent,
  serializeCanvasRichTextContent,
} from './canvas-rich-text-editor'
import type { CanvasRichTextEditor, CanvasRichTextPartialBlock } from './canvas-rich-text-editor'
import { CanvasFloatingFormattingToolbar } from './canvas-floating-formatting-toolbar'
import { CanvasRichTextView } from './canvas-rich-text-view'
import { useBlockNoteActivationLifecycle } from './use-blocknote-activation-lifecycle'
import type {
  RichEmbedActivationPayload,
  RichEmbedLifecycleController,
} from '../embed/use-rich-embed-lifecycle'
import {
  useCanvasEditSessionContext,
  useCanvasNodeActionsContext,
  useCanvasPermissionsContext,
} from '../../runtime/providers/canvas-runtime-hooks'
import {
  useIsCanvasNodeSelected,
  useSelectedCanvasNodeIds,
} from '../../runtime/selection/use-canvas-selection-state'
import { replaceCanvasSelection } from '../../runtime/selection/use-canvas-selection-actions'
import { isExclusivelySelectedNode } from '../../utils/canvas-selection-utils'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

export interface CanvasRichTextNodeData extends Record<string, unknown> {
  content?: Array<CanvasRichTextPartialBlock>
  backgroundColor?: string | null
  borderStroke?: string | null
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
  const reactFlow = useReactFlow()
  const { updateNodeData } = useCanvasNodeActionsContext()
  const canEdit = useCanvasPermissionsContext()
  const editSession = useCanvasEditSessionContext()
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const isSelected = useIsCanvasNodeSelected(id)
  const isExclusivelySelected = isExclusivelySelectedNode(selectedNodeIds, id)
  const [isEditing, setIsEditing] = useState(false)
  const pendingActivationRef = useRef<RichEmbedActivationPayload | null>(null)
  const lifecycle = useRef<RichEmbedLifecycleController>({ pendingActivationRef }).current
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const editFrameRef = useRef<number | null>(null)
  const [editor, setEditor] = useState<CanvasRichTextEditor | null>(null)
  const content = normalizeCanvasRichTextContent(data.content)
  const plainText = extractCanvasRichTextPlainText(content)
  const ariaLabel = plainText || variant.emptyAriaLabel
  const hasPendingAutoEdit = editSession.pendingEditNodeId === id

  const scheduleEditingChange = useCallback((nextEditing: boolean, onCommit?: () => void) => {
    if (editFrameRef.current !== null) {
      cancelAnimationFrame(editFrameRef.current)
    }

    editFrameRef.current = requestAnimationFrame(() => {
      editFrameRef.current = null
      setIsEditing(nextEditing)
      onCommit?.()
    })
  }, [])

  useEffect(() => {
    return () => {
      if (editFrameRef.current !== null) {
        cancelAnimationFrame(editFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    viewport.scrollTop = scrollTopRef.current
  }, [editor, isEditing])

  useEffect(() => {
    if (isEditing && !isExclusivelySelected && !hasPendingAutoEdit) {
      scheduleEditingChange(false)
    }
  }, [hasPendingAutoEdit, isEditing, isExclusivelySelected, scheduleEditingChange])

  useEffect(() => {
    if (!canEdit || isEditing || !hasPendingAutoEdit) {
      return
    }

    if (!isSelected) {
      replaceCanvasSelection(reactFlow, { nodeIds: [id], edgeIds: [] })
      return
    }

    pendingActivationRef.current = editSession.pendingEditNodePoint
      ? { point: editSession.pendingEditNodePoint }
      : null
    scheduleEditingChange(true)
  }, [
    canEdit,
    editSession.pendingEditNodePoint,
    hasPendingAutoEdit,
    id,
    isEditing,
    isSelected,
    reactFlow,
    scheduleEditingChange,
  ])

  useEffect(() => {
    if (!isEditing || !hasPendingAutoEdit || selectedNodeIds.length === 0 || isSelected) {
      return
    }

    editSession.setPendingEditNodeId(null)
    editSession.setPendingEditNodePoint(null)
    scheduleEditingChange(false)
  }, [
    editSession,
    hasPendingAutoEdit,
    isEditing,
    isSelected,
    scheduleEditingChange,
    selectedNodeIds.length,
  ])

  const startEditing = useCallback(
    (point?: { x: number; y: number } | null) => {
      if (!canEdit || !isExclusivelySelected) {
        return
      }

      pendingActivationRef.current = point ? { point } : null
      setIsEditing(true)
    },
    [canEdit, isExclusivelySelected],
  )

  const handlePersistContent = useCallback(
    (nextContent: Array<CanvasRichTextPartialBlock>) => {
      updateNodeData(id, { content: nextContent })
    },
    [id, updateNodeData],
  )

  const handleAutoEditActivated = useCallback(() => {
    if (editSession.pendingEditNodeId !== id) {
      return
    }

    editSession.setPendingEditNodeId(null)
    editSession.setPendingEditNodePoint(null)
  }, [editSession, id])

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType={variant.nodeType}
      dragging={!!dragging}
      minWidth={variant.minWidth}
      minHeight={variant.minHeight}
      editing={isEditing}
    >
      <CanvasFloatingFormattingToolbar editor={editor} visible={isEditing} />
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
          startEditing({ x: event.clientX, y: event.clientY })
        }}
        onKeyDown={(event) => {
          if (!isEditing && (event.key === 'Enter' || event.key === 'F2')) {
            event.preventDefault()
            event.stopPropagation()
            startEditing()
            return
          }

          if (isEditing && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setIsEditing(false)
            wrapperRef.current?.focus()
          }
        }}
      >
        <CanvasNodeConnectionHandles selected={isSelected} />
        <div
          className={cn('h-full', isEditing && 'nodrag nopan', isExclusivelySelected && 'nowheel')}
        >
          <ScrollArea viewportRef={viewportRef} className="h-full">
            <CanvasRichTextContent
              key={id}
              ariaLabel={variant.editAriaLabel}
              content={content}
              editable={isEditing}
              contentClassName={variant.contentClassName}
              textClassName={variant.textClassName}
              onEditorChange={setEditor}
              onPersistContent={handlePersistContent}
              lifecycle={lifecycle}
              onActivated={handleAutoEditActivated}
            />
          </ScrollArea>
        </div>
      </div>
    </ResizableNodeWrapper>
  )
}

interface CanvasRichTextContentProps {
  ariaLabel: string
  content: Array<CanvasRichTextPartialBlock>
  editable: boolean
  contentClassName: string
  textClassName: string
  onEditorChange: (editor: CanvasRichTextEditor | null) => void
  onPersistContent: (content: Array<CanvasRichTextPartialBlock>) => void
  lifecycle: RichEmbedLifecycleController
  onActivated: () => void
}

const CanvasRichTextContent = memo(function CanvasRichTextContent({
  ariaLabel,
  content,
  editable,
  contentClassName,
  textClassName,
  onEditorChange,
  onPersistContent,
  lifecycle,
  onActivated,
}: CanvasRichTextContentProps) {
  const contentKey = useMemo(() => serializeCanvasRichTextContent(content), [content])
  const persistedContentKeyRef = useRef(contentKey)
  const initialContentRef = useRef(content)
  const latestContentRef = useRef(content)
  const lastExternalContentKeyRef = useRef(contentKey)
  const pendingExitContentKeyRef = useRef<string | null>(null)
  const wasEditableRef = useRef(editable)

  latestContentRef.current = content

  const createEditor = useCallback(() => {
    try {
      return BlockNoteEditor.create({
        schema: canvasRichTextEditorSchema,
        initialContent: cloneCanvasRichTextContent(initialContentRef.current),
        placeholders: {
          emptyDocument: '',
          default: '',
          paragraph: '',
          heading: '',
          bulletListItem: '',
          numberedListItem: '',
          checkListItem: '',
          quote: '',
          codeBlock: '',
        },
        domAttributes: {
          editor: {
            'aria-label': ariaLabel,
            class: 'canvas-rich-text-editor',
          },
        },
      }) as CanvasRichTextEditor
    } catch (error) {
      console.error('Error creating BlockNoteEditor for canvas rich text node', {
        ariaLabel,
        error,
      })
      return null
    }
  }, [ariaLabel])

  const destroyEditor = useCallback(
    (nextEditor: CanvasRichTextEditor) => {
      try {
        nextEditor._tiptapEditor.destroy()
      } catch (error) {
        console.error('Error destroying BlockNoteEditor for canvas rich text node', {
          ariaLabel,
          error,
        })
      }
    },
    [ariaLabel],
  )

  const editor = useOwnedBlockNoteEditor({
    createEditor,
    destroyEditor,
    onEditorChange,
  })

  useBlockNoteActivationLifecycle({
    lifecycle,
    editable,
    editor,
    onActivationErrorMessage:
      'Canvas rich text node failed to compute selection from pointer position',
    onActivated,
  })

  useEffect(() => {
    if (!editor) {
      wasEditableRef.current = editable
      return
    }

    const wasEditable = wasEditableRef.current
    wasEditableRef.current = editable

    if (wasEditable && !editable) {
      const finalContent = cloneCanvasRichTextContent(editor.document)
      const finalContentKey = serializeCanvasRichTextContent(finalContent)

      persistedContentKeyRef.current = finalContentKey
      lastExternalContentKeyRef.current = finalContentKey

      if (finalContentKey !== contentKey) {
        pendingExitContentKeyRef.current = finalContentKey
        onPersistContent(finalContent)
      } else {
        pendingExitContentKeyRef.current = null
      }
    }
  }, [contentKey, editable, editor, onPersistContent])

  useEffect(() => {
    if (!editor) {
      return
    }

    if (editable) {
      pendingExitContentKeyRef.current = null
      lastExternalContentKeyRef.current = contentKey
      return
    }

    const pendingExitContentKey = pendingExitContentKeyRef.current
    if (pendingExitContentKey) {
      if (contentKey === pendingExitContentKey) {
        pendingExitContentKeyRef.current = null
        lastExternalContentKeyRef.current = contentKey
      }
      return
    }

    if (contentKey === lastExternalContentKeyRef.current) {
      return
    }

    lastExternalContentKeyRef.current = contentKey

    const editorContentKey = serializeCanvasRichTextContent(editor.document)
    if (editorContentKey === contentKey) {
      persistedContentKeyRef.current = contentKey
      return
    }

    editor.replaceBlocks(editor.document, cloneCanvasRichTextContent(latestContentRef.current))
    persistedContentKeyRef.current = contentKey
  }, [contentKey, editable, editor])

  const handleChange = useCallback(
    (currentEditor: CanvasRichTextEditor) => {
      const nextContent = cloneCanvasRichTextContent(currentEditor.document)
      const nextKey = serializeCanvasRichTextContent(nextContent)
      if (nextKey === persistedContentKeyRef.current) {
        return
      }

      persistedContentKeyRef.current = nextKey
      onPersistContent(nextContent)
    },
    [onPersistContent],
  )

  useEffect(() => {
    if (!editor) {
      return
    }

    return editor.onChange((currentEditor) => {
      handleChange(currentEditor as CanvasRichTextEditor)
    })
  }, [editor, handleChange])

  if (!editor) {
    return <div className={cn('h-full w-full', contentClassName)} />
  }

  return (
    <div className={cn('h-full w-full', contentClassName, textClassName)}>
      <CanvasRichTextView
        editor={editor}
        editable={editable}
        className={cn(
          'h-full w-full bg-transparent',
          '[&_.bn-container]:h-full [&_.bn-container]:bg-transparent',
          '[&_.bn-editor]:h-full [&_.bn-editor]:bg-transparent',
          '[&_.bn-editor]:outline-none [&_.bn-editor]:px-0 [&_.bn-editor]:py-0',
        )}
      />
    </div>
  )
}, areCanvasRichTextContentPropsEqual)

function areCanvasRichTextContentPropsEqual(
  previous: CanvasRichTextContentProps,
  next: CanvasRichTextContentProps,
) {
  if (
    previous.ariaLabel !== next.ariaLabel ||
    previous.editable !== next.editable ||
    previous.contentClassName !== next.contentClassName ||
    previous.textClassName !== next.textClassName ||
    previous.onEditorChange !== next.onEditorChange ||
    previous.onPersistContent !== next.onPersistContent ||
    previous.lifecycle !== next.lifecycle ||
    previous.onActivated !== next.onActivated
  ) {
    return false
  }

  if (previous.editable && next.editable) {
    return true
  }

  return (
    serializeCanvasRichTextContent(previous.content) ===
    serializeCanvasRichTextContent(next.content)
  )
}

function getContainerStyle(data: CanvasRichTextNodeData, textColor: string): CSSProperties {
  return {
    backgroundColor: data.backgroundColor ?? 'transparent',
    border: data.borderStroke ? `1px solid ${data.borderStroke}` : 'none',
    color: textColor,
  }
}
