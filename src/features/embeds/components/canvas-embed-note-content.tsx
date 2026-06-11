import { useReducer } from 'react'
import type { ReactNode } from 'react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type { Doc } from 'yjs'
import type { PendingRichEmbedActivationRef } from '../hooks/use-rich-embed-lifecycle'
import { useBlockNoteActivationLifecycle } from '../hooks/use-blocknote-activation-lifecycle'
import { EmbeddedNoteContent } from '~/features/previews/components/embedded-note-content'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { BlockShareMenuProvider } from '~/features/sharing/contexts/block-share-menu-context'

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
      'useBlockNoteActivationLifecycle: failed to compute selection from posAtCoords/TextSelection.create',
    onActivated,
    pendingActivationRef,
  })

  return (
    <EmbeddedNoteContent
      note={note}
      editable={editable}
      allowInnerScroll={isExclusivelySelected}
      isExclusivelySelected={isExclusivelySelected}
      textColor={textColor}
      onEditorChange={onEditorChange}
      Provider={CanvasEmbeddedNoteProviders}
    />
  )
}

function CanvasEmbeddedNoteProviders({ children }: { children: ReactNode }) {
  return (
    <BlockShareMenuProvider>
      <BlockNoteContextMenuProvider>{children}</BlockNoteContextMenuProvider>
    </BlockShareMenuProvider>
  )
}
