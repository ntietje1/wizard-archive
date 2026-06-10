import { BlockNoteEditor } from '@blocknote/core'
import { SideMenuController } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import {
  getBlockAllPlayersPermissionLevel,
  getEffectiveBlockVisibilityPermissionLevel,
} from 'shared/permissions/block-visibility'
import { hasPermissionForRequirement } from 'shared/permissions/requirements'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createEditorSchema } from '../editor-specs'
import { NoteView } from './note-view'
import { LinkClickHandler } from './extensions/link-click-handler'
import { LiveWikiLinkAutocomplete } from './extensions/wiki-link/live-wiki-link-autocomplete'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import {
  effectiveHasAtLeastPermission,
  resolveSidebarItemPermissionLevel,
} from '~/features/sharing/utils/permission-utils'
import { useOptionalEditorWorkspaceSource } from '../workspace/editor-workspace-source-context'
import { LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS } from '../workspace/live-note-document-source'
import type { Doc } from 'yjs'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { BlockMeta, NoteWithContent } from 'shared/notes/types'
import type { CSSProperties, ReactNode } from 'react'
import type { CampaignActor } from 'shared/campaigns/actor'
import type {
  EditorNoteCollaborationProvider,
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSession,
} from '../workspace/editor-workspace-source'

type NoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
  provider: EditorNoteCollaborationProvider | null,
) => void

type NoteContentBaseProps = {
  editable: boolean
  className?: string
  fillHeight?: boolean
  style?: CSSProperties
  children?: ReactNode
  onEditorChange?: NoteEditorChangeHandler
}

type LiveNoteContentProps = NoteContentBaseProps & {
  note: NoteWithContent
}

export function NoteContent({ note, ...props }: LiveNoteContentProps) {
  const source = useOptionalEditorWorkspaceSource()
  const noteDocuments = source?.documents.notes ?? LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS
  if (source) {
    return (
      <SourceBackedNoteContent
        {...props}
        note={note}
        noteDocuments={noteDocuments}
        renderState={getSourceNoteRenderState({
          note,
          editable: props.editable,
          source,
        })}
      />
    )
  }

  return <LiveNoteContent note={note} noteDocuments={noteDocuments} {...props} />
}

function LiveNoteContent({
  note,
  editable,
  className,
  fillHeight = false,
  style,
  children,
  noteDocuments,
  onEditorChange,
}: LiveNoteContentProps & { noteDocuments: EditorWorkspaceNoteDocuments }) {
  const renderState = useLiveNoteRenderState({ note, editable })

  return (
    <SourceBackedNoteContent
      className={className}
      editable={editable}
      fillHeight={fillHeight}
      note={note}
      noteDocuments={noteDocuments}
      renderState={renderState}
      style={style}
      onEditorChange={onEditorChange}
    >
      {children}
    </SourceBackedNoteContent>
  )
}

function SourceBackedNoteContent({
  children,
  className,
  fillHeight = false,
  noteDocuments,
  onEditorChange,
  renderState,
  style,
}: NoteContentBaseProps & {
  note: NoteWithContent
  noteDocuments: EditorWorkspaceNoteDocuments
  renderState: ReturnType<typeof getSourceNoteRenderState>
}) {
  const editor =
    renderState.kind === 'editable' ? (
      <EditableNoteEditor
        note={renderState.note}
        noteDocuments={noteDocuments}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </EditableNoteEditor>
    ) : (
      <StaticNoteEditor
        note={renderState.note}
        noteId={renderState.noteId}
        noteDocuments={noteDocuments}
        content={renderState.content}
        evaluateValuesFromEditor={renderState.evaluateValuesFromEditor}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </StaticNoteEditor>
    )

  return (
    <div
      className={
        renderState.kind === 'editable' || fillHeight ? 'note-editor-fill-height' : undefined
      }
    >
      <div className={className}>{editor}</div>
    </div>
  )
}

function useLiveNoteRenderState({ note, editable }: { note: NoteWithContent; editable: boolean }):
  | { kind: 'editable'; note: NoteWithContent }
  | {
      kind: 'static'
      note?: NoteWithContent
      noteId?: Id<'sidebarItems'>
      content: Array<CustomBlock>
      evaluateValuesFromEditor: boolean
    } {
  const { campaignActor, viewAsPlayerId } = useEditorMode()
  const { allItemsById } = useFileSystemReadModel()

  const hasEditAccess = effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
    actor: campaignActor,
    allItemsMap: allItemsById,
  })
  const isViewAs = campaignActor?.kind === 'dm_view_as'

  if (editable && hasEditAccess && !isViewAs) {
    return { kind: 'editable', note }
  }

  const hasFullContent = hasEditAccess && !isViewAs

  return {
    kind: 'static',
    note,
    noteId: note._id,
    content: hasFullContent
      ? note.content
      : filterViewableBlocks(note, { actor: campaignActor, viewAsPlayerId, allItemsById }),
    evaluateValuesFromEditor: hasFullContent,
  }
}

function getSourceNoteRenderState({
  editable,
  note,
  source,
}: {
  editable: boolean
  note: NoteWithContent
  source: ReturnType<typeof useOptionalEditorWorkspaceSource>
}):
  | { kind: 'editable'; note: NoteWithContent }
  | {
      kind: 'static'
      note?: NoteWithContent
      noteId?: Id<'sidebarItems'>
      content: Array<CustomBlock>
      evaluateValuesFromEditor: boolean
    } {
  if (!source) {
    return {
      kind: 'static',
      note,
      noteId: note._id,
      content: note.content,
      evaluateValuesFromEditor: false,
    }
  }

  const { campaignActor, viewAsPlayerId } = source.permissions
  const allItemsById = source.index.activeItemsById
  const hasEditAccess = effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
    actor: campaignActor,
    allItemsMap: allItemsById,
  })
  const isViewAs = campaignActor?.kind === 'dm_view_as'

  if (editable && hasEditAccess && !isViewAs) {
    return { kind: 'editable', note }
  }

  const hasFullContent = hasEditAccess && !isViewAs

  return {
    kind: 'static',
    note,
    noteId: note._id,
    content: hasFullContent
      ? note.content
      : filterViewableBlocks(note, { actor: campaignActor, viewAsPlayerId, allItemsById }),
    evaluateValuesFromEditor: hasFullContent,
  }
}

function StaticNoteEditor({
  note,
  noteId,
  content,
  evaluateValuesFromEditor,
  noteDocuments,
  style,
  children,
  onEditorChange,
}: {
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  noteDocuments: EditorWorkspaceNoteDocuments
  content: Array<CustomBlock>
  evaluateValuesFromEditor: boolean
  style?: CSSProperties
  children?: ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const editor = useOwnedBlockNoteEditor({
    identity: `${noteId ?? 'raw-static-note-content'}:${JSON.stringify(content)}`,
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
  const RuntimeProvider = noteDocuments.RuntimeProvider

  if (!editor) return null

  return (
    <RuntimeProvider editor={editor} isViewerMode noteId={noteId}>
      {({ linkResolver, valueRuntimeSource }) => (
        <>
          <NoteView
            editor={editor}
            note={note}
            noteId={noteId}
            editable={false}
            evaluateValuesFromEditor={evaluateValuesFromEditor}
            linkResolver={linkResolver}
            valueRuntimeSource={valueRuntimeSource}
            style={style}
          >
            {children}
          </NoteView>
          <LinkClickHandler editor={editor} sourceNoteId={noteId} />
        </>
      )}
    </RuntimeProvider>
  )
}

function EditableNoteEditor({
  note,
  noteDocuments,
  style,
  children,
  onEditorChange,
}: {
  note: NoteWithContent
  noteDocuments: EditorWorkspaceNoteDocuments
  style?: CSSProperties
  children?: ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const EditableSessionProvider = noteDocuments.EditableSessionProvider

  return (
    <EditableSessionProvider note={note}>
      {(session) => (
        <EditableNoteSessionContent
          note={note}
          noteDocuments={noteDocuments}
          session={session}
          style={style}
          onEditorChange={onEditorChange}
        >
          {children}
        </EditableNoteSessionContent>
      )}
    </EditableSessionProvider>
  )
}

function EditableNoteSessionContent({
  note,
  noteDocuments,
  session,
  style,
  children,
  onEditorChange,
}: {
  note: NoteWithContent
  noteDocuments: EditorWorkspaceNoteDocuments
  session: EditorWorkspaceNoteEditableSession
  style?: CSSProperties
  children?: ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  if (session.error) {
    return (
      <div role="alert" className="min-h-8 text-sm text-muted-foreground">
        Failed to load note content.
      </div>
    )
  }

  if (session.isLoading || !session.doc || !session.provider) {
    return <div aria-label="Loading note content" className="min-h-8" />
  }

  return (
    <CollaborativeNoteEditor
      key={session.instanceId}
      note={note}
      doc={session.doc}
      provider={session.provider}
      user={session.user}
      updateUser={session.updateUser}
      style={style}
      noteDocuments={noteDocuments}
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
  updateUser,
  style,
  children,
  noteDocuments,
  onEditorChange,
}: {
  note: NoteWithContent
  doc: Doc
  provider: EditorNoteCollaborationProvider
  user: { name: string; color: string }
  updateUser?: (user: { color: string; name: string }) => void
  style?: CSSProperties
  children?: ReactNode
  noteDocuments: EditorWorkspaceNoteDocuments
  onEditorChange?: NoteEditorChangeHandler
}) {
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
    updateUser?.({ name: user.name, color: user.color })
  }, [updateUser, user.name, user.color])
  const RuntimeProvider = noteDocuments.RuntimeProvider

  if (!editor) return null

  return (
    <RuntimeProvider editor={editor} isViewerMode={false} noteId={note._id}>
      {({ linkResolver, valueRuntimeSource }) => (
        <>
          <NoteView
            editor={editor}
            note={note}
            editable
            editableChrome={
              <SideMenuController
                sideMenu={(props) => <SideMenuRenderer {...props} note={note} />}
              />
            }
            linkResolver={linkResolver}
            valueRuntimeSource={valueRuntimeSource}
            style={style}
          >
            {children}
            <LiveWikiLinkAutocomplete
              editor={editor}
              onForceOpenRef={forceOpenLinkPopover}
              sourceNoteId={note._id}
            />
          </NoteView>
          <LinkClickHandler editor={editor} sourceNoteId={note._id} />
        </>
      )}
    </RuntimeProvider>
  )
}

function filterViewableBlocks(
  note: NoteWithContent,
  {
    actor,
    viewAsPlayerId,
    allItemsById,
  }: {
    actor: CampaignActor | null
    viewAsPlayerId: Id<'campaignMembers'> | undefined
    allItemsById: Map<Id<'sidebarItems'>, AnySidebarItem>
  },
): Array<CustomBlock> {
  if (actor?.kind === 'dm_view_as' && viewAsPlayerId) {
    const notePermissionLevel = resolveSidebarItemPermissionLevel(
      note,
      viewAsPlayerId,
      allItemsById,
    ).level
    return note.content.filter((block) => {
      const meta = note.blockMeta[block.id]
      if (!meta) return false
      return canViewBlockAsPlayer(meta, { viewAsPlayerId, notePermissionLevel })
    })
  }

  return note.content.filter((block) => {
    const meta = note.blockMeta[block.id]
    if (!meta) return false
    return meta.myPermissionLevel !== PERMISSION_LEVEL.NONE
  })
}

function canViewBlockAsPlayer(
  meta: BlockMeta,
  {
    viewAsPlayerId,
    notePermissionLevel,
  }: {
    viewAsPlayerId: Id<'campaignMembers'>
    notePermissionLevel: PermissionLevel
  },
): boolean {
  const permissionLevel = getEffectiveBlockVisibilityPermissionLevel({
    isDm: false,
    notePermissionLevel,
    allPlayersPermissionLevel: getBlockAllPlayersPermissionLevel(meta.shareStatus),
    memberPermissionLevel: getMemberBlockVisibilityPermissionLevel(meta, viewAsPlayerId),
  })
  return hasPermissionForRequirement(permissionLevel, PERMISSION_LEVEL.VIEW)
}

function getMemberBlockVisibilityPermissionLevel(
  meta: BlockMeta,
  viewAsPlayerId: Id<'campaignMembers'>,
): PermissionLevel | null {
  if ((meta.hiddenFrom ?? []).includes(viewAsPlayerId)) return PERMISSION_LEVEL.NONE
  if (meta.sharedWith.includes(viewAsPlayerId)) return PERMISSION_LEVEL.VIEW
  return null
}
