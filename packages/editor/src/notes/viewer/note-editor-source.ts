import type { ResourceId } from '../../resources/domain-id'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { WorkspaceMode } from '../../../../../shared/workspace/workspace-mode'
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
  NoteScrollRequest,
  NoteWikiLinkContentSource,
} from '../runtime'
import type { NoteScrollStore } from './use-scroll-persistence'
import type { EditorPermissionLevel, EditorShareParticipant } from '../../sharing/contracts'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../value-runtime-model'

export type NoteEditorSetParticipantPermission = (input: {
  itemIds: Array<ResourceId>
  participantId: EditorShareParticipant['id']
  permissionLevel: EditorPermissionLevel
}) => MaybePromise<void>

export interface NoteEditorSource {
  canEdit: boolean
  editorMode: WorkspaceMode
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
  scrollRequest: NoteScrollRequest
  scrollStore: NoteScrollStore
  sharingSource: NoteSharingContentSource
  sharing:
    | { status: 'unsupported' }
    | {
        status: 'available'
        participants: Array<EditorShareParticipant>
        setParticipantPermission: NoteEditorSetParticipantPermission
      }
  wikiLinkSource: NoteWikiLinkContentSource
}
