import { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useRef, useState } from 'react'
import { editorSchema } from 'convex/notes/editorSpecs'
import { api } from 'convex/_generated/api'
import { NoteView } from './note-view'
import { WikiLinkAutocomplete } from './extensions/wiki-link/wiki-link-autocomplete'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { logger } from '~/shared/utils/logger'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
} from '~/features/editor/utils/patch-yundo-destroy'

type NoteContentProps = {
  noteId: Id<'notes'>
  content: Array<CustomBlock>
  editable: boolean
  className?: string
  children?: React.ReactNode
  onEditorChange?: (
    editor: CustomBlockNoteEditor | null,
    doc: Doc | null,
  ) => void
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
        {editable ? (
          <CollaborativeEditorLoader
            noteId={noteId}
            content={content}
            onEditorChange={onEditorChange}
          >
            {children}
          </CollaborativeEditorLoader>
        ) : (
          <StaticEditorInner content={content} onEditorChange={onEditorChange}>
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
  noteId: Id<'notes'>
  content: Array<CustomBlock>
  children?: React.ReactNode
  onEditorChange?: (
    editor: CustomBlockNoteEditor | null,
    doc: Doc | null,
  ) => void
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
  content,
  children,
  onEditorChange,
}: {
  content: Array<CustomBlock>
  children?: React.ReactNode
  onEditorChange?: (
    editor: CustomBlockNoteEditor | null,
    doc: Doc | null,
  ) => void
}) {
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const onEditorChangeRef = useRef(onEditorChange)
  onEditorChangeRef.current = onEditorChange
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    const initialContent = content.length > 0 ? content : undefined
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent,
    }) as CustomBlockNoteEditor

    setEditor(instance)
    onEditorChangeRef.current?.(instance, null)

    return () => {
      instance._tiptapEditor.destroy()
      onEditorChangeRef.current?.(null, null)
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
    <NoteView editor={editor} editable={false}>
      {children}
    </NoteView>
  )
}

function CollaborativeEditorInner({
  doc,
  provider,
  user,
  children,
  onEditorChange,
}: {
  doc: Doc
  provider: ConvexYjsProvider
  user: { name: string; color: string }
  children?: React.ReactNode
  onEditorChange?: (
    editor: CustomBlockNoteEditor | null,
    doc: Doc | null,
  ) => void
}) {
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const onEditorChangeRef = useRef(onEditorChange)
  onEditorChangeRef.current = onEditorChange

  useEffect(() => {
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document'),
        user: { name: user.name, color: user.color },
        showCursorLabels: 'activity',
      },
    }) as CustomBlockNoteEditor

    setEditor(instance)
    onEditorChangeRef.current?.(instance, doc)

    let cancelled = false
    let retries = 0
    const MAX_RETRIES = 30
    const tryPatch = () => {
      if (cancelled) return
      if (instance._tiptapEditor.view.state.plugins.length === 0) {
        if (++retries >= MAX_RETRIES) {
          logger.error('Failed to patch Yjs plugins', {
            maxRetries: MAX_RETRIES,
          })
          return
        }
        setTimeout(tryPatch, 50)
        return
      }
      patchYUndoPluginDestroy(instance._tiptapEditor.view)
      patchYSyncAfterTypeChanged(instance._tiptapEditor.view)
    }
    setTimeout(tryPatch, 50)

    return () => {
      cancelled = true
      instance._tiptapEditor.destroy()
      onEditorChangeRef.current?.(null, null)
    }
  }, [doc, provider]) // purposely don't include user.name and user.color

  if (!editor) return null

  return (
    <NoteView editor={editor} editable={true}>
      <WikiLinkAutocomplete editor={editor} />
      {children}
    </NoteView>
  )
}
