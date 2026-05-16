import { BlockNoteEditor } from '@blocknote/core'
import { useCallback, useEffect, useRef } from 'react'
import { editorSchema } from 'convex/notes/editorSpecs'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { NoteView } from './note-view'
import { LinkClickHandler } from './extensions/link-click-handler'
import { WikiLinkAutocomplete } from './extensions/wiki-link/wiki-link-autocomplete'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { BlockMeta, NoteWithContent } from 'convex/notes/types'
import type { CSSProperties } from 'react'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { SHARE_STATUS } from 'convex/blockShares/types'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
} from '~/features/editor/utils/patch-yundo-destroy'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { assertNever } from '~/shared/utils/utils'

/**
 * Receives the current editor lifecycle state. editor is null during teardown,
 * doc/provider are null for static editors, and doc/provider are non-null for
 * collaborative editors.
 */
type NoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
  provider: ConvexYjsProvider | null,
) => void

type NoteContentBaseProps = {
  editable: boolean
  className?: string
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}

type LiveNoteContentProps = NoteContentBaseProps & {
  note: NoteWithContent
  noteId?: never
  content?: never
}

type RawNoteContentProps = NoteContentBaseProps & {
  note?: never
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
}

type NoteContentProps = LiveNoteContentProps | RawNoteContentProps

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isCustomBlockNoteEditor(editor: unknown): editor is CustomBlockNoteEditor {
  if (!isRecord(editor)) return false

  const tiptapEditor = editor._tiptapEditor

  return (
    Array.isArray(editor.document) &&
    typeof editor.replaceBlocks === 'function' &&
    isRecord(tiptapEditor) &&
    typeof tiptapEditor.destroy === 'function' &&
    'view' in tiptapEditor
  )
}

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

export function NoteContent({ note, noteId, content, ...props }: NoteContentProps) {
  if (note) {
    return <LiveNoteContent note={note} {...props} />
  }

  return <NoteContentBody noteId={noteId} content={content} {...props} />
}

function LiveNoteContent({ note, editable, ...props }: LiveNoteContentProps) {
  const { content, editable: resolvedEditable } = useLiveNoteRenderState(note, editable)

  return (
    <NoteContentBody
      note={note}
      noteId={note._id}
      content={content}
      editable={resolvedEditable}
      {...props}
    />
  )
}

function NoteContentBody({
  note,
  noteId,
  content,
  editable,
  className,
  style,
  children,
  onEditorChange,
}: NoteContentBaseProps & {
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
}) {
  return (
    <div className={editable ? 'note-editor-fill-height' : undefined}>
      <div className={className}>
        {editable && noteId ? (
          <CollaborativeEditorLoader
            note={note}
            noteId={noteId}
            content={content}
            style={style}
            onEditorChange={onEditorChange}
          >
            {children}
          </CollaborativeEditorLoader>
        ) : (
          <StaticEditorInner
            note={note}
            noteId={noteId}
            content={content}
            style={style}
            onEditorChange={onEditorChange}
          >
            {children}
          </StaticEditorInner>
        )}
      </div>
    </div>
  )
}

function useLiveNoteRenderState(note: NoteWithContent, requestedEditable: boolean) {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap } = useActiveSidebarItems()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }
  const hasEditAccess = effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, permOpts)

  if (hasEditAccess) {
    return {
      content: note.content,
      editable: requestedEditable,
    }
  }

  return {
    content: filterViewableBlocks(note, { isDm, viewAsPlayerId }),
    editable: false,
  }
}

function filterViewableBlocks(
  note: NoteWithContent,
  {
    isDm,
    viewAsPlayerId,
  }: {
    isDm: boolean | undefined
    viewAsPlayerId: Id<'campaignMembers'> | undefined
  },
) {
  if (isDm && viewAsPlayerId) {
    return note.content.filter((block) => {
      const meta = note.blockMeta[block.id]
      if (!meta) return false
      return canViewBlockAsPlayer(meta, viewAsPlayerId)
    })
  }

  return note.content.filter((block) => {
    const meta = note.blockMeta[block.id]
    if (!meta) return false
    return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
  })
}

function canViewBlockAsPlayer(meta: BlockMeta, viewAsPlayerId: Id<'campaignMembers'>): boolean {
  switch (meta.shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return true
    case SHARE_STATUS.INDIVIDUALLY_SHARED:
      return meta.sharedWith.includes(viewAsPlayerId)
    case SHARE_STATUS.NOT_SHARED:
      return false
    default:
      return assertNever(meta.shareStatus)
  }
}

function CollaborativeEditorLoader({
  note,
  noteId,
  content,
  style,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId: Id<'sidebarItems'>
  content: Array<CustomBlock>
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
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
      <StaticEditorInner
        note={note}
        noteId={noteId}
        content={content}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </StaticEditorInner>
    )
  }

  return (
    <CollaborativeEditorInner
      key={instanceId}
      note={note}
      noteId={noteId}
      doc={doc}
      provider={provider}
      style={style}
      user={{ name: userName, color: userColor }}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeEditorInner>
  )
}

function StaticEditorInner({
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
  const initialContentRef = useRef(content)
  const linkResolver = useLinkResolver(noteId)
  const hasInitializedRef = useRef(false)

  const createEditor = useCallback(() => {
    try {
      const createdEditor = BlockNoteEditor.create({
        schema: editorSchema,
        initialContent:
          initialContentRef.current.length > 0 ? initialContentRef.current : undefined,
      })

      if (!isCustomBlockNoteEditor(createdEditor)) {
        throw new Error('Created editor does not match CustomBlockNoteEditor')
      }

      return createdEditor
    } catch (error) {
      console.error('Error creating BlockNoteEditor for static note content', { noteId, error })
      return null
    }
  }, [noteId])

  const destroyEditor = useCallback(
    (editor: CustomBlockNoteEditor) => {
      destroyNoteEditor(editor, noteId, 'static')
    },
    [noteId],
  )

  const editor = useOwnedBlockNoteEditor({
    createEditor,
    destroyEditor,
    onEditorChange: (nextEditor) => {
      onEditorChange?.(nextEditor, null, null)
    },
  })

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
      <NoteView
        editor={editor}
        note={note}
        editable={false}
        linkResolver={linkResolver}
        style={style}
      >
        {children}
      </NoteView>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
    </>
  )
}

function CollaborativeEditorInner({
  note,
  noteId,
  doc,
  provider,
  style,
  user,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId: Id<'sidebarItems'>
  doc: Doc
  provider: ConvexYjsProvider
  style?: CSSProperties
  user: { name: string; color: string }
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const linkResolver = useLinkResolver(noteId)
  const userRef = useRef(user)
  userRef.current = user

  useEffect(() => {
    provider.setUser({ name: user.name, color: user.color })
  }, [provider, user.color, user.name])

  const createEditor = useCallback(() => {
    try {
      const createdEditor = BlockNoteEditor.create({
        schema: editorSchema,
        collaboration: {
          provider,
          fragment: doc.getXmlFragment('document'),
          user: { name: userRef.current.name, color: userRef.current.color },
          showCursorLabels: 'activity',
        },
      })

      if (!isCustomBlockNoteEditor(createdEditor)) {
        throw new Error('Created editor does not match CustomBlockNoteEditor')
      }

      try {
        patchYUndoPluginDestroy(createdEditor._tiptapEditor.view)
        patchYSyncAfterTypeChanged(createdEditor._tiptapEditor.view)
      } catch (error) {
        destroyNoteEditor(createdEditor, noteId, 'collaborative')
        throw error
      }

      return createdEditor
    } catch (error) {
      console.error('Error creating BlockNoteEditor for collaborative note content', {
        noteId,
        error,
      })
      return null
    }
  }, [doc, noteId, provider])

  const destroyEditor = useCallback(
    (editor: CustomBlockNoteEditor) => {
      destroyNoteEditor(editor, noteId, 'collaborative')
    },
    [noteId],
  )

  const editor = useOwnedBlockNoteEditor({
    createEditor,
    destroyEditor,
    onEditorChange: (nextEditor) => {
      onEditorChange?.(nextEditor, doc, provider)
    },
  })

  const forceOpenLinkPopover = useRef<(() => void) | null>(null)

  if (!editor) return null

  return (
    <>
      <NoteView
        editor={editor}
        note={note}
        editable={true}
        linkResolver={linkResolver}
        style={style}
      >
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
