import type {
  WizardEditorCanvasEmbeddedSessionPorts,
  WizardEditorCanvasSessionPorts,
  WizardEditorNoteEditorSession,
  WizardEditorNoteHeadingSessionPorts,
  WizardEditorNotePlaybackSessionPorts,
  WizardEditorNoteSessionPorts,
  WizardEditorNoteValueSessionPorts,
} from '@wizard-archive/editor/adapter'

export function createTestCanvasSessionPorts(): WizardEditorCanvasSessionPorts {
  return {
    document: {
      useCanvasDocumentSession: () => ({
        status: 'error',
        error: 'Canvas session is not available in this test source.',
      }),
    },
  }
}

export function createTestCanvasEmbeddedSessionPorts(): WizardEditorCanvasEmbeddedSessionPorts {
  return {
    embeddedCanvas: {
      useEmbeddedCanvasState: () => ({
        nodes: [],
        edges: [],
        status: 'unavailable',
      }),
    },
  }
}

export function createTestNoteSessionPorts({
  useCollaborationSession = () => {
    throw new Error('Collaboration sessions are not used in this test fixture')
  },
}: {
  useCollaborationSession?: WizardEditorNoteSessionPorts['document']['useCollaborationSession']
} = {}): WizardEditorNoteSessionPorts {
  return {
    document: { useCollaborationSession },
  }
}

export function createTestNoteHeadingSessionPorts({
  useNoteHeadings = () => ({ headings: [], status: 'success' }),
}: {
  useNoteHeadings?: WizardEditorNoteHeadingSessionPorts['headings']['useNoteHeadings']
} = {}): WizardEditorNoteHeadingSessionPorts {
  return {
    headings: { useNoteHeadings },
  }
}

export function createTestNotePlaybackSessionPorts({
  getCollaborationPlayback,
}: {
  getCollaborationPlayback?: WizardEditorNotePlaybackSessionPorts['playback']['getCollaborationPlayback']
} = {}): WizardEditorNotePlaybackSessionPorts {
  return {
    playback: getCollaborationPlayback ? { getCollaborationPlayback } : {},
  }
}

export function createTestNoteValueSessionPorts({
  useNoteValueStates = () => ({ states: [], status: 'success' }),
}: {
  useNoteValueStates?: WizardEditorNoteValueSessionPorts['values']['useNoteValueStates']
} = {}): WizardEditorNoteValueSessionPorts {
  return {
    values: { useNoteValueStates },
  }
}

export function createTestNoteSessionPortsWithSession(
  session: WizardEditorNoteEditorSession,
): WizardEditorNoteSessionPorts {
  return createTestNoteSessionPorts({
    useCollaborationSession: () => session,
  })
}
