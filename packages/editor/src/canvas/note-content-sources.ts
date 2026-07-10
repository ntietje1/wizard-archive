import type {
  EmbeddedNoteContentSource,
  NoteDocumentContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../notes/runtime'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../notes/value-runtime-model'

export interface CanvasNoteContentSources {
  noteDocumentSource: NoteDocumentContentSource
  noteEmbeddedNoteContentSource: EmbeddedNoteContentSource
  noteEmbedTargetSource: NoteEmbedTargetContentSource
  noteLinkCreationSource: NoteLinkCreationSource | null
  noteLinkNavigationSource: NoteLinkNavigationSource | null
  noteLinkResolutionSource: NoteLinkResolutionSource
  notePlaybackSource: NotePlaybackContentSource
  notePermissionSource: NotePermissionContentSource
  noteSharingSource: NoteSharingContentSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  noteWikiLinkSource: NoteWikiLinkContentSource
}
