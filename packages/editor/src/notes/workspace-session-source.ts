import type { ResourceId } from '../resources/domain-id'
import type { Heading } from './document/model'
import type { NoteItemWithContent } from './item-contract'
import type { NoteCollaborationPlayback } from './playback-contract'
import type { NoteEditorSession } from './session-contract'
import type { NoteValueRuntimeStateSource } from './value-runtime-model'

export interface NoteCollaborationSessionRequest {
  mode: NoteEditorSession['mode']
  note: NoteItemWithContent
}

export interface NoteSessionPorts {
  document: NoteDocumentSessionSource
}

export interface NoteHeadingSessionPorts {
  headings: NoteHeadingSource
}

export interface NotePlaybackSessionPorts {
  playback: NotePlaybackSource
}

export interface NoteValueSessionPorts {
  values: NoteValueRuntimeStateSource
}

interface NoteDocumentSessionSource {
  useCollaborationSession: (request: NoteCollaborationSessionRequest) => NoteEditorSession
}

interface NotePlaybackSource {
  getCollaborationPlayback?: (noteId: ResourceId) => NoteCollaborationPlayback | undefined
}

interface NoteHeadingSource {
  useNoteHeadings: (noteId: ResourceId | null) => NoteHeadingsLoad
}

type NoteHeadingsLoadStatus = 'pending' | 'success' | 'error'

interface NoteHeadingsLoad {
  headings: Array<Heading>
  status: NoteHeadingsLoadStatus
}
