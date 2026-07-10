import { BlockNoteEditor } from '@blocknote/core'
import { SideMenuController } from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { getNoteRenderState } from './render-state'
import { createEditorSchema } from './editor-specs'
import { NoteView } from './view'
import { SideMenuRenderer, SideMenuRuntimeProvider } from './side-menu/side-menu'
import { useOwnedBlockNoteEditor } from '../rich-text/blocknote/use-owned-blocknote-editor'
import { destroyBlockNoteEditor } from '../rich-text/blocknote/destroy-blocknote-editor'
import {
  NoteLinkClickHandler,
  NoteDocumentRuntime,
  NoteWikiLinkAutocomplete,
  NoteEditableSession,
} from './document-runtime'
import { StaticNoteContent } from './static-content'
import { createEmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'
import type { Doc } from 'yjs'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { NoteItemWithContent } from '../notes/item-contract'
import type { CSSProperties, ReactNode } from 'react'
import { useNoteCollaborationPlayback } from './use-collaboration-playback'
import type { YjsCollaborationProvider } from '../collaboration/yjs-provider'
import type { NoteEditorSession } from './session-contract'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from './runtime'
import { NOTE_YJS_FRAGMENT } from './document/headless-yjs'
import type { NoteCollaborationPlayback } from './playback-contract'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'
import { createDetachedNotePlaybackEngine } from './playback-collaboration-adapter'

type NoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
  provider: YjsCollaborationProvider | null,
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
  documentSource: NoteDocumentContentSource
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note: NoteItemWithContent
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  permissionsSource: NotePermissionContentSource
  playbackSource: NotePlaybackContentSource
  sharingSource: NoteSharingContentSource
  wikiLinkSource: NoteWikiLinkContentSource
}

export function NoteContent({
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteValueReferences,
  noteValueStateSource,
  permissionsSource,
  playbackSource,
  sharingSource,
  wikiLinkSource,
  ...props
}: LiveNoteContentProps) {
  const renderState = getNoteRenderState({
    canAccessItem: permissionsSource.canAccessItem,
    editable: props.editable,
    getMemberItemPermissionLevel: permissionsSource.getMemberItemPermissionLevel,
    note,
    viewAsPlayerId: permissionsSource.selectedViewAsPlayerId,
  })

  return (
    <NoteContentBody
      {...props}
      documentSource={documentSource}
      embeddedNoteContentSource={embeddedNoteContentSource}
      embedTargetSource={embedTargetSource}
      linkCreationSource={linkCreationSource}
      linkNavigationSource={linkNavigationSource}
      linkResolutionSource={linkResolutionSource}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
      playbackSource={playbackSource}
      renderState={renderState}
      sharingSource={sharingSource}
      wikiLinkSource={wikiLinkSource}
    />
  )
}

function NoteContentBody({
  children,
  className,
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  fillHeight = false,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  noteValueReferences,
  noteValueStateSource,
  onEditorChange,
  playbackSource,
  renderState,
  sharingSource,
  style,
  wikiLinkSource,
}: NoteContentBaseProps & {
  documentSource: NoteDocumentContentSource
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  playbackSource: NotePlaybackContentSource
  renderState: ReturnType<typeof getNoteRenderState>
  sharingSource: NoteSharingContentSource
  wikiLinkSource: NoteWikiLinkContentSource
}) {
  const editor =
    renderState.kind === 'editable' ? (
      <EditableNoteEditor
        documentSource={documentSource}
        embeddedNoteContentSource={embeddedNoteContentSource}
        embedTargetSource={embedTargetSource}
        linkCreationSource={linkCreationSource}
        linkNavigationSource={linkNavigationSource}
        linkResolutionSource={linkResolutionSource}
        note={renderState.note}
        noteValueReferences={noteValueReferences}
        noteValueStateSource={noteValueStateSource}
        playbackSource={playbackSource}
        sharingSource={sharingSource}
        style={style}
        wikiLinkSource={wikiLinkSource}
        onEditorChange={onEditorChange}
      >
        {children}
      </EditableNoteEditor>
    ) : (
      <StaticNoteContent
        note={renderState.note}
        noteId={renderState.noteId}
        content={renderState.content}
        evaluateValuesFromEditor={renderState.evaluateValuesFromEditor}
        embeddedNoteContentSource={embeddedNoteContentSource}
        embedTargetSource={embedTargetSource}
        linkNavigationSource={linkNavigationSource}
        linkResolutionSource={linkResolutionSource}
        noteValueReferences={noteValueReferences}
        noteValueStateSource={noteValueStateSource}
        style={style}
        onEditorChange={(nextEditor) => onEditorChange?.(nextEditor, null, null)}
      >
        {children}
      </StaticNoteContent>
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

function EditableNoteEditor({
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteValueReferences,
  noteValueStateSource,
  playbackSource,
  sharingSource,
  style,
  children,
  wikiLinkSource,
  onEditorChange,
}: {
  documentSource: NoteDocumentContentSource
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note: NoteItemWithContent
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  playbackSource: NotePlaybackContentSource
  sharingSource: NoteSharingContentSource
  style?: CSSProperties
  children?: ReactNode
  wikiLinkSource: NoteWikiLinkContentSource
  onEditorChange?: NoteEditorChangeHandler
}) {
  return (
    <NoteEditableSession key={note.id} note={note} source={documentSource}>
      {(session) => (
        <EditableNoteEditorSessionContent
          embeddedNoteContentSource={embeddedNoteContentSource}
          embedTargetSource={embedTargetSource}
          linkCreationSource={linkCreationSource}
          linkNavigationSource={linkNavigationSource}
          linkResolutionSource={linkResolutionSource}
          note={note}
          noteValueReferences={noteValueReferences}
          noteValueStateSource={noteValueStateSource}
          playbackSource={playbackSource}
          session={session}
          sharingSource={sharingSource}
          style={style}
          wikiLinkSource={wikiLinkSource}
          onEditorChange={onEditorChange}
        >
          {children}
        </EditableNoteEditorSessionContent>
      )}
    </NoteEditableSession>
  )
}

function EditableNoteEditorSessionContent({
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteValueReferences,
  noteValueStateSource,
  playbackSource,
  session,
  sharingSource,
  style,
  children,
  wikiLinkSource,
  onEditorChange,
}: {
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  note: NoteItemWithContent
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  playbackSource: NotePlaybackContentSource
  session: NoteEditorSession
  sharingSource: NoteSharingContentSource
  style?: CSSProperties
  children?: ReactNode
  wikiLinkSource: NoteWikiLinkContentSource
  onEditorChange?: NoteEditorChangeHandler
}) {
  const playback = playbackSource.getNoteCollaborationPlayback?.(note.id)
  const activePlayback = playback?.noteId === note.id ? playback : undefined

  if (session.status === 'error') {
    return (
      <div role="alert" className="min-h-8 text-sm text-muted-foreground">
        Failed to load note content.
      </div>
    )
  }

  if (session.status === 'loading') {
    return <div aria-label="Loading note content" className="min-h-8" />
  }

  if (session.status === 'unavailable') {
    return (
      <div role="alert" className="min-h-8 text-sm text-muted-foreground">
        Note content is unavailable.
      </div>
    )
  }

  if (activePlayback) {
    return (
      <IsolatedPlaybackNoteEditor
        key={createNotePlaybackEngineKey(note, activePlayback)}
        embeddedNoteContentSource={embeddedNoteContentSource}
        embedTargetSource={embedTargetSource}
        note={note}
        linkNavigationSource={linkNavigationSource}
        linkResolutionSource={linkResolutionSource}
        noteValueReferences={noteValueReferences}
        noteValueStateSource={noteValueStateSource}
        playback={activePlayback}
        user={session.user}
        style={style}
        linkCreationSource={linkCreationSource}
        sharingSource={sharingSource}
        wikiLinkSource={wikiLinkSource}
        onEditorChange={onEditorChange}
      >
        {children}
      </IsolatedPlaybackNoteEditor>
    )
  }

  return (
    <CollaborativeNoteEditor
      key={session.instanceId}
      note={note}
      doc={session.engine.doc}
      embeddedNoteContentSource={embeddedNoteContentSource}
      embedTargetSource={embedTargetSource}
      linkNavigationSource={linkNavigationSource}
      linkResolutionSource={linkResolutionSource}
      provider={session.engine.provider}
      playback={undefined}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
      user={session.user}
      updateUser={session.updateUser}
      style={style}
      linkCreationSource={linkCreationSource}
      sharingSource={sharingSource}
      wikiLinkSource={wikiLinkSource}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeNoteEditor>
  )
}

function CollaborativeNoteEditor({
  note,
  doc,
  embeddedNoteContentSource,
  embedTargetSource,
  linkNavigationSource,
  linkResolutionSource,
  provider,
  playback,
  noteValueReferences,
  noteValueStateSource,
  user,
  updateUser,
  style,
  children,
  linkCreationSource,
  sharingSource,
  wikiLinkSource,
  onEditorChange,
}: {
  note: NoteItemWithContent
  doc: Doc
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  provider: YjsCollaborationProvider
  playback: NoteCollaborationPlayback | undefined
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  user: { name: string; color: string }
  updateUser?: (user: { color: string; name: string }) => void
  style?: CSSProperties
  children?: ReactNode
  linkCreationSource: NoteLinkCreationSource | null
  sharingSource: NoteSharingContentSource
  wikiLinkSource: NoteWikiLinkContentSource
  onEditorChange?: NoteEditorChangeHandler
}) {
  const forceOpenLinkPopover = useRef<(() => void) | null>(null)
  const editor = useOwnedBlockNoteEditor({
    identity: provider,
    createEditor: () =>
      BlockNoteEditor.create({
        schema: createEditorSchema(),
        disableExtensions: ['link', 'dropFile'],
        collaboration: {
          provider,
          fragment: doc.getXmlFragment(NOTE_YJS_FRAGMENT),
          user,
          showCursorLabels: 'activity',
        },
      }) as unknown as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange: (nextEditor) => onEditorChange?.(nextEditor, doc, provider),
  })

  useEffect(() => {
    const nextUser = { name: user.name, color: user.color }
    if (playback) {
      provider.awareness.setLocalStateField('user', nextUser)
      return
    }
    updateUser?.(nextUser)
  }, [playback, provider, updateUser, user.name, user.color])

  useNoteCollaborationPlayback({
    editor,
    noteId: note.id,
    playback,
    provider,
  })

  if (!editor) return null

  return (
    <NoteDocumentRuntime
      editor={editor}
      isViewerMode={false}
      noteId={note.id}
      linkResolutionSource={linkResolutionSource}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
    >
      {({ linkResolver, valueRuntimeSource }) => (
        <>
          <NoteView
            editor={editor}
            note={note}
            editable
            editableChrome={
              <SideMenuRuntimeProvider blockSharing={sharingSource.blocks} note={note}>
                <SideMenuController sideMenu={SideMenuRenderer} />
              </SideMenuRuntimeProvider>
            }
            embedTargetOperations={embedTargetSource.embedTargetOperations}
            linkResolver={linkResolver}
            renderEmbeddedNotePreview={createEmbeddedNotePreviewRenderer({
              source: embeddedNoteContentSource,
            })}
            valueRuntimeSource={valueRuntimeSource}
            style={style}
          >
            {children}
            <NoteWikiLinkAutocomplete
              editor={editor}
              onForceOpenRef={forceOpenLinkPopover}
              source={wikiLinkSource}
              sourceNoteId={note.id}
            />
          </NoteView>
          <NoteLinkClickHandler
            editor={editor}
            editorMode="editor"
            forceOpenLinkPopover={() => forceOpenLinkPopover.current?.()}
            linkCreation={linkCreationSource}
            linkNavigationSource={linkNavigationSource}
            sourceNoteId={note.id}
          />
        </>
      )}
    </NoteDocumentRuntime>
  )
}

function IsolatedPlaybackNoteEditor({
  note,
  playback,
  embeddedNoteContentSource,
  embedTargetSource,
  linkNavigationSource,
  linkResolutionSource,
  noteValueReferences,
  noteValueStateSource,
  user,
  style,
  children,
  linkCreationSource,
  sharingSource,
  wikiLinkSource,
  onEditorChange,
}: {
  note: NoteItemWithContent
  playback: NoteCollaborationPlayback
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  user: { name: string; color: string }
  style?: CSSProperties
  children?: ReactNode
  linkCreationSource: NoteLinkCreationSource | null
  sharingSource: NoteSharingContentSource
  wikiLinkSource: NoteWikiLinkContentSource
  onEditorChange?: NoteEditorChangeHandler
}) {
  const [playbackEngine] = useState(() => createDetachedNotePlaybackEngine(note.content))

  useEffect(() => {
    return () => playbackEngine.destroy()
  }, [playbackEngine])

  return (
    <CollaborativeNoteEditor
      note={note}
      doc={playbackEngine.doc}
      embeddedNoteContentSource={embeddedNoteContentSource}
      embedTargetSource={embedTargetSource}
      linkNavigationSource={linkNavigationSource}
      linkResolutionSource={linkResolutionSource}
      provider={playbackEngine.provider}
      playback={playback}
      noteValueReferences={noteValueReferences}
      noteValueStateSource={noteValueStateSource}
      user={user}
      style={style}
      linkCreationSource={linkCreationSource}
      sharingSource={sharingSource}
      wikiLinkSource={wikiLinkSource}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeNoteEditor>
  )
}

function createNotePlaybackEngineKey(
  note: NoteItemWithContent,
  playback: NoteCollaborationPlayback,
) {
  return [
    note.id,
    JSON.stringify(note.content),
    playback.noteId,
    playback.initialTypingStep,
    playback.intervalMs ?? '',
    playback.typingBlockIndex,
    playback.typingText,
  ].join(':')
}
