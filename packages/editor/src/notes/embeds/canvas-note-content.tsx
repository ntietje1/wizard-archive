import type { ReactNode } from 'react'
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
} from '../runtime'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { PendingRichEmbedActivationRef } from '../../rich-text/deferred-activation'
import { useBlockNoteActivationLifecycle } from '../../rich-text/blocknote/activation-lifecycle'
import { EmbeddedNoteContent } from './embedded-note-content'
import { BlockNoteContextMenuProvider } from '../context-menu/provider'
import { BlockShareMenuProvider } from '../../sharing/block/menu'
import { useEditorDocState } from './editor-doc-state'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../value-runtime-model'

export function EmbedNoteContent({
  note,
  editable,
  isExclusivelySelected,
  onActivated,
  onCanvasEditorChange,
  pendingActivationRef,
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  noteValueReferences,
  noteValueStateSource,
  permissionSource,
  playbackSource,
  sharingSource,
  textColor,
  wikiLinkSource,
}: {
  note: NoteItemWithContent
  editable: boolean
  isExclusivelySelected: boolean
  onActivated?: () => void
  onCanvasEditorChange?: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  documentSource: NoteDocumentContentSource
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  permissionSource: NotePermissionContentSource
  playbackSource: NotePlaybackContentSource
  sharingSource: NoteSharingContentSource
  textColor: string | null
  wikiLinkSource: NoteWikiLinkContentSource
}) {
  const [{ doc, editor }, handleEditorChange] = useEditorDocState((newEditor) => {
    onCanvasEditorChange?.(newEditor)
  })

  const isReady = () => {
    return !!doc
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
    <CanvasEmbeddedNoteProviders blockSharing={sharingSource.blocks}>
      <EmbeddedNoteContent
        note={note}
        editable={editable}
        allowInnerScroll={isExclusivelySelected}
        isExclusivelySelected={isExclusivelySelected}
        textColor={textColor}
        onEditorChange={handleEditorChange}
        documentSource={documentSource}
        embeddedNoteContentSource={embeddedNoteContentSource}
        embedTargetSource={embedTargetSource}
        linkCreationSource={linkCreationSource}
        linkNavigationSource={linkNavigationSource}
        linkResolutionSource={linkResolutionSource}
        noteValueReferences={noteValueReferences}
        noteValueStateSource={noteValueStateSource}
        permissionSource={permissionSource}
        playbackSource={playbackSource}
        sharingSource={sharingSource}
        wikiLinkSource={wikiLinkSource}
      />
    </CanvasEmbeddedNoteProviders>
  )
}

function CanvasEmbeddedNoteProviders({
  blockSharing,
  children,
}: {
  blockSharing: NoteSharingContentSource['blocks']
  children: ReactNode
}) {
  return (
    <BlockShareMenuProvider blockSharing={blockSharing}>
      <BlockNoteContextMenuProvider>{children}</BlockNoteContextMenuProvider>
    </BlockShareMenuProvider>
  )
}
