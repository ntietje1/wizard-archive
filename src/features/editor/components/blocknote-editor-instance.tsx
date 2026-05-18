import { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useRef } from 'react'
import { editorSchema } from 'convex/notes/editorSpecs'
import { BlockNoteShell } from './blocknote-shell'
import { LinkClickHandler } from './extensions/link-click-handler'
import { WikiLinkAutocomplete } from './extensions/wiki-link/wiki-link-autocomplete'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'
import type { CSSProperties } from 'react'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'

export type NoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
  provider: ConvexYjsProvider | null,
) => void

function destroyNoteEditor(
  editor: CustomBlockNoteEditor,
  noteId: Id<'sidebarItems'> | undefined,
  mode: 'static' | 'collaborative',
) {
  try {
    destroyBlockNoteEditor(editor)
  } catch (error) {
    console.error(`Error destroying BlockNoteEditor for ${mode} note content`, {
      noteId,
      error,
    })
  }
}

export function StaticBlockNoteEditor({
  note,
  noteId,
  content,
  style,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const linkResolver = useLinkResolver(noteId)
  const initializedEditorRef = useRef<CustomBlockNoteEditor | null>(null)
  const instanceIdentity = noteId ?? 'raw-static-note-content'

  const editor = useOwnedBlockNoteEditor({
    identity: instanceIdentity,
    createEditor: () => {
      try {
        return BlockNoteEditor.create({
          schema: editorSchema,
          initialContent: content.length > 0 ? content : undefined,
        })
      } catch (error) {
        console.error('Error creating BlockNoteEditor for static note content', { noteId, error })
        return null
      }
    },
    destroyEditor: (editorToDestroy) => {
      destroyNoteEditor(editorToDestroy, noteId, 'static')
    },
    onEditorChange: (nextEditor) => {
      onEditorChange?.(nextEditor, null, null)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (initializedEditorRef.current !== editor) {
      initializedEditorRef.current = editor
      return
    }
    editor.replaceBlocks(editor.document, content)
  }, [editor, content])

  if (!editor) return null

  return (
    <>
      <BlockNoteShell
        editor={editor}
        note={note}
        editable={false}
        linkResolver={linkResolver}
        style={style}
      >
        {children}
      </BlockNoteShell>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
    </>
  )
}

export function CollaborativeBlockNoteEditor({
  note,
  noteId,
  doc,
  provider,
  instanceId,
  style,
  user,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId: Id<'sidebarItems'>
  doc: Doc
  provider: ConvexYjsProvider
  instanceId: number
  style?: CSSProperties
  user: { name: string; color: string }
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const linkResolver = useLinkResolver(noteId)
  const userRef = useRef(user)
  const forceOpenLinkPopover = useRef<(() => void) | null>(null)
  userRef.current = user

  useEffect(() => {
    provider.setUser({ name: user.name, color: user.color })
  }, [provider, user.color, user.name])

  const editor = useOwnedBlockNoteEditor({
    identity: instanceId,
    createEditor: () => {
      try {
        return BlockNoteEditor.create({
          schema: editorSchema,
          collaboration: {
            provider,
            fragment: doc.getXmlFragment('document'),
            user: { name: userRef.current.name, color: userRef.current.color },
            showCursorLabels: 'activity',
          },
        })
      } catch (error) {
        console.error('Error creating BlockNoteEditor for collaborative note content', {
          noteId,
          error,
        })
        return null
      }
    },
    destroyEditor: (editorToDestroy) => {
      destroyNoteEditor(editorToDestroy, noteId, 'collaborative')
    },
    onEditorChange: (nextEditor) => {
      onEditorChange?.(nextEditor, doc, provider)
    },
  })

  if (!editor) return null

  return (
    <>
      <BlockNoteShell
        editor={editor}
        note={note}
        editable={true}
        linkResolver={linkResolver}
        style={style}
      >
        {children}
      </BlockNoteShell>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
      <WikiLinkAutocomplete
        editor={editor}
        onForceOpenRef={forceOpenLinkPopover}
        sourceNoteId={noteId}
      />
    </>
  )
}
