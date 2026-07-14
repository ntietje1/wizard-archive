import type { ResourceId } from '../resources/domain-id'
import { BlockNoteEditor } from '@blocknote/core'
import { createEditorSchema } from './editor-specs'
import { destroyBlockNoteEditor } from '../rich-text/blocknote/destroy-blocknote-editor'
import { useOwnedBlockNoteEditor } from '../rich-text/blocknote/use-owned-blocknote-editor'
import { useCallback, useRef } from 'react'
import type { CustomBlockNoteEditor } from './editor-schema'

import type { NoteBlock } from './document/model'

export type StaticNoteEditorChangeHandler = (editor: CustomBlockNoteEditor | null) => void

export function useStaticNoteContentEditor({
  content,
  noteId,
  onEditorChange,
}: {
  content: Array<NoteBlock>
  noteId: ResourceId | undefined
  onEditorChange?: StaticNoteEditorChangeHandler
}) {
  const editorIdentity = useStaticNoteContentIdentity(noteId, content)
  const createEditor = useCallback(
    () =>
      BlockNoteEditor.create({
        schema: createEditorSchema(),
        disableExtensions: ['link'],
        initialContent:
          content.length > 0
            ? (content as NonNullable<
                Parameters<typeof BlockNoteEditor.create>[0]
              >['initialContent'])
            : undefined,
      }) as unknown as CustomBlockNoteEditor,
    [content],
  )

  return useOwnedBlockNoteEditor({
    identity: editorIdentity,
    createEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange,
  })
}

function useStaticNoteContentIdentity(noteId: ResourceId | undefined, content: Array<NoteBlock>) {
  const identityRef = useRef<{
    content: Array<NoteBlock>
    identity: string
    noteId: ResourceId | undefined
  } | null>(null)

  if (
    !identityRef.current ||
    identityRef.current.content !== content ||
    identityRef.current.noteId !== noteId
  ) {
    identityRef.current = {
      content,
      noteId,
      identity: `${noteId ?? 'static-note-content'}:${JSON.stringify(content)}`,
    }
  }

  return identityRef.current.identity
}
