import type { NoteEditorSession } from '../notes/session-contract'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../notes/workspace-session-source'

export function createTestNoteSessionPorts({
  useCollaborationSession = () => {
    throw new Error('Collaboration sessions are not used in this test fixture')
  },
}: {
  useCollaborationSession?: NoteSessionPorts['document']['useCollaborationSession']
} = {}): NoteSessionPorts {
  return {
    document: { useCollaborationSession },
  }
}

export function createTestNoteHeadingSessionPorts({
  useNoteHeadings = () => ({ headings: [], status: 'success' }),
}: {
  useNoteHeadings?: NoteHeadingSessionPorts['headings']['useNoteHeadings']
} = {}): NoteHeadingSessionPorts {
  return {
    headings: { useNoteHeadings },
  }
}

export function createTestNotePlaybackSessionPorts({
  getCollaborationPlayback,
}: {
  getCollaborationPlayback?: NotePlaybackSessionPorts['playback']['getCollaborationPlayback']
} = {}): NotePlaybackSessionPorts {
  return {
    playback: getCollaborationPlayback ? { getCollaborationPlayback } : {},
  }
}

export function createTestNoteValueSessionPorts({
  useNoteValueStates = () => ({ states: [], status: 'success' }),
}: {
  useNoteValueStates?: NoteValueSessionPorts['values']['useNoteValueStates']
} = {}): NoteValueSessionPorts {
  return {
    values: { useNoteValueStates },
  }
}

export function createTestNoteSessionPortsWithSession(
  session: NoteEditorSession,
): NoteSessionPorts {
  return createTestNoteSessionPorts({
    useCollaborationSession: () => session,
  })
}
