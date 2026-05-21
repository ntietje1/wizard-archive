import { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useRef } from 'react'
import { SHARE_STATUS } from 'convex/blockShares/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { createEditorSchema } from '../editor-specs'
import { NoteView } from './note-view'
import { LinkClickHandler } from './extensions/link-click-handler'
import { WikiLinkAutocomplete } from './extensions/wiki-link/wiki-link-autocomplete'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { assertNever } from '~/shared/utils/utils'
import { api } from 'convex/_generated/api'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { BlockMeta, NoteWithContent } from 'convex/notes/types'
import type { CSSProperties } from 'react'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

export type NoteEditorChangeHandler = (
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

export function NoteContent({
  note,
  noteId,
  content,
  editable,
  className,
  style,
  children,
  onEditorChange,
}: NoteContentProps) {
  const renderState = useNoteRenderState({ note, noteId, content, editable })
  const editor =
    renderState.kind === 'editable' ? (
      <EditableNoteEditor note={renderState.note} style={style} onEditorChange={onEditorChange}>
        {children}
      </EditableNoteEditor>
    ) : (
      <StaticNoteEditor
        note={renderState.note}
        noteId={renderState.noteId}
        content={renderState.content}
        evaluateValuesFromEditor={renderState.evaluateValuesFromEditor}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </StaticNoteEditor>
    )

  return (
    <div className={renderState.kind === 'editable' ? 'note-editor-fill-height' : undefined}>
      <div className={className}>{editor}</div>
    </div>
  )
}

function useNoteRenderState({
  note,
  noteId,
  content,
  editable,
}: {
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  content?: Array<CustomBlock>
  editable: boolean
}):
  | { kind: 'editable'; note: NoteWithContent }
  | {
      kind: 'static'
      note?: NoteWithContent
      noteId?: Id<'sidebarItems'>
      content: Array<CustomBlock>
      evaluateValuesFromEditor: boolean
    } {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { allItemsById } = useFileSystemReadModel()

  if (!note) {
    return {
      kind: 'static',
      noteId,
      content: content ?? [],
      evaluateValuesFromEditor: true,
    }
  }

  const hasEditAccess = effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
    isDm,
    viewAsPlayerId: undefined,
    allItemsMap: allItemsById,
  })
  const isViewAs = Boolean(isDm && viewAsPlayerId)

  if (editable && hasEditAccess && !isViewAs) {
    return { kind: 'editable', note }
  }

  const hasFullContent = hasEditAccess && !isViewAs

  return {
    kind: 'static',
    note,
    noteId: note._id,
    content: hasFullContent ? note.content : filterViewableBlocks(note, { isDm, viewAsPlayerId }),
    evaluateValuesFromEditor: hasFullContent,
  }
}

function StaticNoteEditor({
  note,
  noteId,
  content,
  evaluateValuesFromEditor,
  style,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
  evaluateValuesFromEditor: boolean
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const linkResolver = useLinkResolver(noteId, { isViewerMode: true })
  const initializedEditorRef = useRef<CustomBlockNoteEditor | null>(null)
  const editor = useOwnedBlockNoteEditor({
    identity: noteId ?? 'raw-static-note-content',
    createEditor: () =>
      BlockNoteEditor.create({
        schema: createEditorSchema(),
        initialContent:
          content.length > 0
            ? (content as NonNullable<
                Parameters<typeof BlockNoteEditor.create>[0]
              >['initialContent'])
            : undefined,
      }) as unknown as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange: (nextEditor) => onEditorChange?.(nextEditor, null, null),
  })

  useEffect(() => {
    if (!editor) return
    if (initializedEditorRef.current !== editor) {
      initializedEditorRef.current = editor
      return
    }
    editor.replaceBlocks(
      editor.document,
      content as Parameters<CustomBlockNoteEditor['replaceBlocks']>[1],
    )
  }, [editor, content])

  if (!editor) return null

  return (
    <>
      <NoteView
        editor={editor}
        note={note}
        noteId={noteId}
        editable={false}
        evaluateValuesFromEditor={evaluateValuesFromEditor}
        linkResolver={linkResolver}
        style={style}
      >
        {children}
      </NoteView>
      <LinkClickHandler editor={editor} sourceNoteId={noteId} />
    </>
  )
}

function EditableNoteEditor({
  note,
  style,
  children,
  onEditorChange,
}: {
  note: NoteWithContent
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const user = {
    name: profile?.name ?? profile?.username ?? 'Anonymous',
    color: profile ? getCursorColor(profile._id) : '#61afef',
  }
  const session = useNoteYjsCollaboration(note._id, user, true)

  if (session.isLoading || !session.doc || !session.provider) {
    return <div aria-label="Loading note content" className="min-h-8" />
  }

  return (
    <CollaborativeNoteEditor
      key={session.instanceId}
      note={note}
      doc={session.doc}
      provider={session.provider}
      user={user}
      style={style}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeNoteEditor>
  )
}

function CollaborativeNoteEditor({
  note,
  doc,
  provider,
  user,
  style,
  children,
  onEditorChange,
}: {
  note: NoteWithContent
  doc: Doc
  provider: ConvexYjsProvider
  user: { name: string; color: string }
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const linkResolver = useLinkResolver(note._id, { isViewerMode: false })
  const forceOpenLinkPopover = useRef<(() => void) | null>(null)
  const editor = useOwnedBlockNoteEditor({
    identity: provider,
    createEditor: () =>
      BlockNoteEditor.create({
        schema: createEditorSchema(),
        collaboration: {
          provider,
          fragment: doc.getXmlFragment('document'),
          user,
          showCursorLabels: 'activity',
        },
      }) as unknown as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange: (nextEditor) => onEditorChange?.(nextEditor, doc, provider),
  })

  useEffect(() => {
    provider.setUser({ name: user.name, color: user.color })
  }, [provider, user.name, user.color])

  if (!editor) return null

  return (
    <>
      <NoteView editor={editor} note={note} editable linkResolver={linkResolver} style={style}>
        {children}
      </NoteView>
      <LinkClickHandler editor={editor} sourceNoteId={note._id} />
      <WikiLinkAutocomplete
        editor={editor}
        onForceOpenRef={forceOpenLinkPopover}
        sourceNoteId={note._id}
      />
    </>
  )
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
): Array<CustomBlock> {
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
