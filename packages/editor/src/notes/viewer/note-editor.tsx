import type { ResourceId } from '../../resources/domain-id'
import { use, useEffect, useRef, useState } from 'react'
import { WORKSPACE_MODE } from '../../../../../shared/workspace/workspace-mode'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import { NoteContent } from '../content'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { BlockNoteContextMenuContext } from '../context-menu/blocknote-context-menu'
import { BlockNoteContextMenuProvider } from '../context-menu/provider'
import { NoteFormattingToolbar } from './note-formatting-toolbar'
import { useScrollPersistence } from './use-scroll-persistence'
import { useScopedNoteEditorStore } from '../editor-store'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { BlockShareMenuProvider } from '../../sharing/block/menu'
import { BlockShareAccessWarningIndicator } from './block-share-access-warning-indicator'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { getBlockNoteContextFromTarget } from '../context-menu/target-context'
import type { Doc } from 'yjs'
import type { WorkspaceMode } from '../../../../../shared/workspace/workspace-mode'
import type { YjsCollaborationProvider } from '../../collaboration/yjs-provider'

import type { NoteEditorSource } from './note-editor-source'

type NoteEditorChangeHandler = (
  editor: CustomBlockNoteEditor | null,
  doc: Doc | null,
  provider: YjsCollaborationProvider | null,
) => void

type NoteEditorState = {
  onEditorChange: NoteEditorChangeHandler
  wrapperRef: React.RefObject<HTMLDivElement | null>
}

function getContextMenuTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target
  }
  if (target instanceof Node) {
    return target.parentElement
  }
  return null
}

function isSelectedNoteEmbedTarget(target: Element) {
  const blockContainer = target
    .closest('.note-embed-block')
    ?.closest('[data-node-type="blockContainer"]')
  if (!blockContainer) return false

  const selection = blockContainer.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed) return false

  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(blockContainer)) return true
    } catch {
      return false
    }
  }

  return false
}

function preserveSelectedNoteEmbedRange(event: React.PointerEvent) {
  if (event.button !== 2) return

  const target = getContextMenuTarget(event.target)
  if (target && isSelectedNoteEmbedTarget(target)) event.preventDefault()
}

type NoteEditorProps = {
  item: NoteItemWithContent
  source: NoteEditorSource
}

export function NoteEditor({ item: note, source }: NoteEditorProps) {
  const editorState = useSourceNoteEditorState(note.id)
  const hasHeadingRequest = source.scrollRequest.status === 'requested'

  return (
    <NoteEditorBody
      note={note}
      editorMode={source.editorMode}
      canEdit={source.canEdit}
      documentSource={source.documentSource}
      embeddedNoteContentSource={source.embeddedNoteContentSource}
      embedTargetSource={source.embedTargetSource}
      editorState={editorState}
      hasHeadingRequest={hasHeadingRequest}
      linkCreationSource={source.linkCreationSource}
      linkNavigationSource={source.linkNavigationSource}
      linkResolutionSource={source.linkResolutionSource}
      noteValueReferences={source.noteValueReferences}
      noteValueStateSource={source.noteValueStateSource}
      permissionSource={source.permissionSource}
      playbackSource={source.playbackSource}
      scrollStore={source.scrollStore}
      sharing={source.sharing}
      sharingSource={source.sharingSource}
      wikiLinkSource={source.wikiLinkSource}
    />
  )
}

function NoteEditorBody({
  canEdit,
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  editorState,
  editorMode,
  hasHeadingRequest,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteValueReferences,
  noteValueStateSource,
  permissionSource,
  playbackSource,
  scrollStore,
  sharing,
  sharingSource,
  wikiLinkSource,
}: {
  canEdit: boolean
  documentSource: NoteEditorSource['documentSource']
  embeddedNoteContentSource: NoteEditorSource['embeddedNoteContentSource']
  embedTargetSource: NoteEditorSource['embedTargetSource']
  editorState: NoteEditorState
  editorMode: WorkspaceMode
  hasHeadingRequest: boolean
  linkCreationSource: NoteEditorSource['linkCreationSource']
  linkNavigationSource: NoteEditorSource['linkNavigationSource']
  linkResolutionSource: NoteEditorSource['linkResolutionSource']
  note: NoteItemWithContent
  noteValueReferences: NoteEditorSource['noteValueReferences']
  noteValueStateSource: NoteEditorSource['noteValueStateSource']
  permissionSource: NoteEditorSource['permissionSource']
  playbackSource: NoteEditorSource['playbackSource']
  scrollStore: NoteEditorSource['scrollStore']
  sharing: NoteEditorSource['sharing']
  sharingSource: NoteEditorSource['sharingSource']
  wikiLinkSource: NoteEditorSource['wikiLinkSource']
}) {
  const editable = editorMode === WORKSPACE_MODE.EDITOR && canEdit

  const { onEditorChange, wrapperRef } = editorState
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null)
  useScrollPersistence(note.id, viewportElement, scrollStore, hasHeadingRequest)

  if (note.type !== RESOURCE_TYPES.notes) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  return (
    <ClientOnly fallback={null}>
      <BlockShareMenuProvider blockSharing={sharingSource.blocks}>
        <BlockNoteContextMenuProvider>
          <NoteEditorContextMenuSurface
            documentSource={documentSource}
            editable={editable}
            embeddedNoteContentSource={embeddedNoteContentSource}
            embedTargetSource={embedTargetSource}
            linkCreationSource={linkCreationSource}
            linkNavigationSource={linkNavigationSource}
            linkResolutionSource={linkResolutionSource}
            note={note}
            noteValueReferences={noteValueReferences}
            noteValueStateSource={noteValueStateSource}
            permissionSource={permissionSource}
            playbackSource={playbackSource}
            setViewportElement={setViewportElement}
            sharing={sharing}
            sharingSource={sharingSource}
            wrapperRef={wrapperRef}
            wikiLinkSource={wikiLinkSource}
            onEditorChange={onEditorChange}
          />
        </BlockNoteContextMenuProvider>
      </BlockShareMenuProvider>
    </ClientOnly>
  )
}

function NoteEditorContextMenuSurface({
  documentSource,
  editable,
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  note,
  noteValueReferences,
  noteValueStateSource,
  permissionSource,
  playbackSource,
  setViewportElement,
  sharing,
  sharingSource,
  wrapperRef,
  wikiLinkSource,
  onEditorChange,
}: {
  documentSource: NoteEditorSource['documentSource']
  editable: boolean
  embeddedNoteContentSource: NoteEditorSource['embeddedNoteContentSource']
  embedTargetSource: NoteEditorSource['embedTargetSource']
  linkCreationSource: NoteEditorSource['linkCreationSource']
  linkNavigationSource: NoteEditorSource['linkNavigationSource']
  linkResolutionSource: NoteEditorSource['linkResolutionSource']
  note: NoteItemWithContent
  noteValueReferences: NoteEditorSource['noteValueReferences']
  noteValueStateSource: NoteEditorSource['noteValueStateSource']
  permissionSource: NoteEditorSource['permissionSource']
  playbackSource: NoteEditorSource['playbackSource']
  setViewportElement: (element: HTMLDivElement | null) => void
  sharing: NoteEditorSource['sharing']
  sharingSource: NoteEditorSource['sharingSource']
  wrapperRef: React.RefObject<HTMLDivElement | null>
  wikiLinkSource: NoteEditorSource['wikiLinkSource']
  onEditorChange: NoteEditorChangeHandler
}) {
  const contextMenu = use(BlockNoteContextMenuContext)
  const editor = useScopedNoteEditorStore((s) => s.editor)

  const openNoteContextMenu = (e: React.MouseEvent, target: Element) => {
    e.preventDefault()
    e.stopPropagation()

    const isBlockNoteContext = target.closest('.bn-editor') !== null
    const blockNoteContext = isBlockNoteContext
      ? getBlockNoteContextFromTarget({
          editable,
          editor,
          position: { x: e.clientX, y: e.clientY },
          target,
        })
      : {
          noteBlockId: undefined,
          valueInlineId: undefined,
          valueInlineInstanceId: undefined,
          valueInlineEditable: false,
        }

    contextMenu?.openMenu({
      position: { x: e.clientX, y: e.clientY },
      surface: 'note-view',
      note,
      isEditorTextContext: isBlockNoteContext,
      ...blockNoteContext,
    })
  }

  const handleWrapperContextMenu = (e: React.MouseEvent) => {
    const target = getContextMenuTarget(e.target)
    if (!target) return
    openNoteContextMenu(e, target)
  }

  const handleEditorTextContextMenuCapture = (e: React.MouseEvent) => {
    const target = getContextMenuTarget(e.target)
    if (!target?.closest('.bn-editor')) return
    openNoteContextMenu(e, target)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col flex-1 min-h-0"
      data-testid="note-editor-wrapper"
      onPointerDownCapture={preserveSelectedNoteEmbedRange}
      onContextMenuCapture={handleEditorTextContextMenuCapture}
      onContextMenu={handleWrapperContextMenu}
    >
      {note.blockShareAccessWarnings.length > 0 && sharing.status === 'available' && (
        <BlockShareAccessWarningIndicator
          noteId={note.id}
          participants={sharing.participants}
          setParticipantPermission={sharing.setParticipantPermission}
          warnings={note.blockShareAccessWarnings}
        />
      )}
      <NoteFormattingToolbar editor={editor} visible={editable} />
      <ScrollArea
        viewportRef={setViewportElement}
        className="flex-1 min-h-0"
        contentClassName={editable ? 'note-editor-scroll-content' : undefined}
      >
        <NoteContent
          key={note.id}
          note={note}
          editable={editable}
          documentSource={documentSource}
          embeddedNoteContentSource={embeddedNoteContentSource}
          embedTargetSource={embedTargetSource}
          linkCreationSource={linkCreationSource}
          linkNavigationSource={linkNavigationSource}
          linkResolutionSource={linkResolutionSource}
          noteValueReferences={noteValueReferences}
          noteValueStateSource={noteValueStateSource}
          playbackSource={playbackSource}
          permissionsSource={permissionSource}
          sharingSource={sharingSource}
          wikiLinkSource={wikiLinkSource}
          onEditorChange={onEditorChange}
          className="note-editor-surface"
        />
      </ScrollArea>
    </div>
  )
}

function useSourceNoteEditorState(noteId: ResourceId): NoteEditorState {
  const claimEditor = useScopedNoteEditorStore((s) => s.claimEditor)
  const [releaseEditor, setReleaseEditor] = useState<(() => void) | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const onEditorChange: NoteEditorChangeHandler = (newEditor, _newDoc, provider) => {
    const nextReleaseEditor = claimEditor(newEditor, provider)
    setReleaseEditor(() => nextReleaseEditor)
  }

  useEffect(() => {
    return () => {
      releaseEditor?.()
    }
  }, [noteId, releaseEditor])

  return { onEditorChange, wrapperRef }
}
