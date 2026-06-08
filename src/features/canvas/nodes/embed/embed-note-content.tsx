import { useEffect, useReducer, useRef } from 'react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type { Doc } from 'yjs'
import type { PendingRichEmbedActivationRef } from './use-rich-embed-lifecycle'
import { NoteContent } from '~/features/editor/components/note-content'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { useBlockNoteActivationLifecycle } from '../shared/use-blocknote-activation-lifecycle'
import { getCanvasNodeTextStyle } from '../shared/canvas-node-surface-style'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { BlockShareMenuProvider } from '~/features/sharing/contexts/block-share-menu-context'
import { cn } from '~/features/shadcn/lib/utils'

interface EmbedNoteEditorState {
  doc: Doc | null
  editor: CustomBlockNoteEditor | null
}

export function EmbedNoteContent({
  note,
  editable,
  isExclusivelySelected,
  onActivated,
  onCanvasEditorChange,
  pendingActivationRef,
  textColor,
}: {
  note: NoteWithContent
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

  const isReady = () => {
    return !!doc
  }

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
        'canvas-rich-text-editor h-full pt-2',
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
        <BlockShareMenuProvider>
          <BlockNoteContextMenuProvider>
            <NoteContent
              note={note}
              editable={editable}
              style={textStyle}
              onEditorChange={onEditorChange}
            />
          </BlockNoteContextMenuProvider>
        </BlockShareMenuProvider>
      </ScrollArea>
    </div>
  )
}
