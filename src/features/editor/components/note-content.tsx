import { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useRef, useState } from 'react'
import { editorSchema } from 'convex/notes/editorSpecs'
import { api } from 'convex/_generated/api'
import { NoteView } from './note-view'
import { LinkClickHandler } from './extensions/link-click-handler'
import { WikiLinkAutocomplete } from './extensions/wiki-link/wiki-link-autocomplete'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
} from '~/features/editor/utils/patch-yundo-destroy'

type NoteContentProps = {
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
  editable: boolean
  className?: string
  children?: React.ReactNode
  onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: Doc | null) => void
}

export function NoteContent({
  noteId,
  content,
  editable,
  className,
  children,
  onEditorChange,
}: NoteContentProps) {
  return (
    <div className={editable ? 'note-editor-fill-height' : undefined}>
      <div className={className}>
        {editable && noteId ? (
          <CollaborativeEditorLoader
            noteId={noteId}
            content={content}
            onEditorChange={onEditorChange}
          >
            {children}
          </CollaborativeEditorLoader>
        ) : (
          <StaticEditorInner noteId={noteId} content={content} onEditorChange={onEditorChange}>
            {children}
          </StaticEditorInner>
        )}
      </div>
    </div>
  )
}

function CollaborativeEditorLoader({
  noteId,
  content,
  children,
  onEditorChange,
}: {
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
  children?: React.ReactNode
  onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: Doc | null) => void
}) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data

  const userName = profile?.name ?? profile?.username ?? 'Anonymous'
  const userColor = profile ? getCursorColor(profile._id) : '#61afef'

  const { doc, provider, instanceId, isLoading } = useNoteYjsCollaboration(
    noteId,
    { name: userName, color: userColor },
    true,
  )

  if (isLoading || !doc || !provider) {
    return (
      <StaticEditorInner content={content} onEditorChange={onEditorChange}>
        {children}
      </StaticEditorInner>
    )
  }

  return (
    <CollaborativeEditorInner
      key={instanceId}
      noteId={noteId}
      doc={doc}
      provider={provider}
      user={{ name: userName, color: userColor }}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeEditorInner>
  )
}

function StaticEditorInner({
  noteId,
  content,
  children,
  onEditorChange,
}: {
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
  children?: React.ReactNode
  onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: Doc | null) => void
}) {
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const editorRef = useRef<CustomBlockNoteEditor | null>(null)
  editorRef.current = editor
  const initialContentRef = useRef(content)
  const linkResolver = useLinkResolver(noteId)
  const onEditorChangeRef = useRef(onEditorChange)
  onEditorChangeRef.current = onEditorChange
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    const nextEditor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: initialContentRef.current.length > 0 ? initialContentRef.current : undefined,
    }) as CustomBlockNoteEditor

    setEditor(nextEditor)
    onEditorChangeRef.current?.(nextEditor, null)

    return () => {
      const shouldClearEditor = editorRef.current === nextEditor
      if (shouldClearEditor) {
        setEditor(null)
        onEditorChangeRef.current?.(null, null)
      }
      nextEditor._tiptapEditor.destroy()
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      return
    }
    editor.replaceBlocks(editor.document, content)
  }, [editor, content])

  if (!editor) return null

  return (
    <>
      <NoteView editor={editor} editable={false} linkResolver={linkResolver}>
        {children}
      </NoteView>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
    </>
  )}

function CollaborativeEditorInner({
  noteId,
  doc,
  provider,
  user,
  children,
  onEditorChange,
}: {
  noteId: Id<'sidebarItems'>
  doc: Doc
  provider: ConvexYjsProvider
  user: { name: string; color: string }
  children?: React.ReactNode
  onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: Doc | null) => void
}) {
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const editorRef = useRef<CustomBlockNoteEditor | null>(null)
  editorRef.current = editor
  const linkResolver = useLinkResolver(noteId)
  const onEditorChangeRef = useRef(onEditorChange)
  onEditorChangeRef.current = onEditorChange

  useEffect(() => {
    const nextEditor = BlockNoteEditor.create({
      schema: editorSchema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document'),
        user: { name: user.name, color: user.color },
        showCursorLabels: 'activity',
      },
    }) as CustomBlockNoteEditor
    patchYUndoPluginDestroy(nextEditor._tiptapEditor.view)
    patchYSyncAfterTypeChanged(nextEditor._tiptapEditor.view)

    setEditor(nextEditor)
    onEditorChangeRef.current?.(nextEditor, doc)

    return () => {
      const shouldClearEditor = editorRef.current === nextEditor
      if (shouldClearEditor) {
        setEditor(null)
        onEditorChangeRef.current?.(null, null)
      }
      nextEditor._tiptapEditor.destroy()
    }
  }, [doc, provider, user.color, user.name])

  const forceOpenLinkPopover = useRef<(() => void) | null>(null)

  if (!editor) return null

  return (
    <>
      <NoteView editor={editor} editable={true} linkResolver={linkResolver}>
        {children}
      </NoteView>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
      <WikiLinkAutocomplete
        editor={editor}
        onForceOpenRef={forceOpenLinkPopover}
        sourceNoteId={noteId}
      />
    </>
  )
}
