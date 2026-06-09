import { Fragment, useEffect, useReducer, useRef } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { NoteWithContent } from 'shared/notes/types'
import type { Doc } from 'yjs'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

interface EmbeddedNoteEditorState {
  doc: Doc | null
  editor: CustomBlockNoteEditor | null
}

type EmbeddedNoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
) => void

export function EmbeddedNoteContent({
  note,
  editable,
  allowInnerScroll = true,
  constrained = false,
  isExclusivelySelected = false,
  textColor = null,
  onEditorChange,
  Provider = Fragment,
}: {
  note: NoteWithContent
  editable: boolean
  allowInnerScroll?: boolean
  constrained?: boolean
  isExclusivelySelected?: boolean
  textColor?: string | null
  onEditorChange?: EmbeddedNoteEditorChangeHandler
  Provider?: ComponentType<{ children: ReactNode }>
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const textStyle = getEmbeddedNoteTextStyle(textColor)
  const maxPreviewHeight = constrained ? 'min(480px, 70vh)' : undefined
  const [{ doc, editor }, setEditorState] = useReducer(
    (_state: EmbeddedNoteEditorState, nextState: EmbeddedNoteEditorState) => nextState,
    {
      doc: null,
      editor: null,
    },
  )

  const handleEditorChange = (newEditor: CustomBlockNoteEditor | null, newDoc: Doc | null) => {
    setEditorState({ doc: newDoc, editor: newEditor })
    onEditorChange?.(newEditor, newDoc)
  }

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
        constrained && 'overflow-hidden',
        editable && 'nodrag nopan',
        isExclusivelySelected && 'nowheel',
      )}
      data-embedded-note-mode={editable ? 'editable' : 'readonly'}
      data-testid="embed-note-content-wrapper"
      style={{
        ...textStyle,
        ...(maxPreviewHeight ? { maxHeight: maxPreviewHeight } : {}),
      }}
    >
      <ScrollArea
        viewportRef={viewportRef}
        className="h-full"
        contentClassName="note-editor-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={{
          ...(maxPreviewHeight ? { maxHeight: maxPreviewHeight } : {}),
          ...(!allowInnerScroll ? { overflowY: 'hidden' as const } : {}),
        }}
      >
        <Provider>
          <NoteContent
            note={note}
            editable={editable}
            fillHeight
            style={textStyle}
            onEditorChange={handleEditorChange}
          />
        </Provider>
      </ScrollArea>
    </div>
  )
}

function getEmbeddedNoteTextStyle(textColor: string | null): CSSProperties {
  if (!textColor) return {}
  return {
    color: textColor,
    '--editor-text-color': textColor,
  } as CSSProperties
}
