import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { Doc } from 'yjs'
import type { PendingRichEmbedActivationRef } from './use-rich-embed-lifecycle'
import { NoteContent } from '~/features/editor/components/note-content'
import { useBlockNoteActivationLifecycle } from '../shared/use-blocknote-activation-lifecycle'
import { getCanvasNodeTextStyle } from '../shared/canvas-node-surface-style'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

interface EmbedNoteEditorState {
  doc: Doc | null
  editor: CustomBlockNoteEditor | null
}

export function EmbedNoteContent({
  noteId,
  content,
  editable,
  isExclusivelySelected,
  onActivated,
  onCanvasEditorChange,
  pendingActivationRef,
  textColor,
}: {
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
  editable: boolean
  isExclusivelySelected: boolean
  onActivated?: () => void
  onCanvasEditorChange?: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const textStyle = getCanvasNodeTextStyle({ textColor })
  const [{ doc, editor }, setEditorState] = useReducer(
    (_state: EmbedNoteEditorState, nextState: EmbedNoteEditorState) => nextState,
    {
      doc: null,
      editor: null,
    },
  )

  const isReady = useCallback(() => {
    return !!doc
  }, [doc])

  const onEditorChange = (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
    setEditorState({ doc: newDoc, editor: newEditor })
    onCanvasEditorChange?.(newEditor)
  }

  useBlockNoteActivationLifecycle({
    editor,
    editable,
    isReady,
    onActivationErrorMessage:
      'useNoteEmbedLifecycle: failed to compute selection from posAtCoords/TextSelection.create',
    onActivated,
    pendingActivationRef,
  })

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

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || scrollTopRef.current <= 0) return

    const raf = requestAnimationFrame(() => {
      viewport.scrollTop = scrollTopRef.current
    })

    return () => cancelAnimationFrame(raf)
  }, [doc, editable, editor])

  return (
    <div
      className={cn(
        'canvas-rich-text-editor h-full',
        editable && 'nodrag nopan',
        isExclusivelySelected && 'nowheel',
      )}
      data-testid="embed-note-content-wrapper"
      style={textStyle}
    >
      <ScrollArea
        viewportRef={viewportRef}
        className="h-full"
        contentClassName={editable ? 'note-editor-scroll-content' : undefined}
      >
        <NoteContent
          noteId={noteId}
          content={content}
          editable={editable}
          style={textStyle}
          onEditorChange={onEditorChange}
        />
      </ScrollArea>
    </div>
  )
}
