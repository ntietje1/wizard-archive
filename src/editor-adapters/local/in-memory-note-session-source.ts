import { useEffect, useRef } from 'react'
import type { SidebarItemId } from 'shared/common/ids'
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness'
import type { Doc } from 'yjs'
import {
  createWizardEditorNoteYDocFromContent,
  readWizardEditorNoteYDocMarkdown,
} from '@wizard-archive/editor/adapter'
import type { YjsCollaborationProvider } from '@wizard-archive/editor/collaboration/yjs-provider'
import type {
  WizardEditorNoteCollaborationSessionMode,
  WizardEditorNoteCollaborationSessionRequest,
  WizardEditorNoteCollaborationPlayback,
  WizardEditorNoteEditorSession,
  WizardEditorNoteHeadingSessionPorts,
  WizardEditorNotePlaybackSessionPorts,
  WizardEditorNoteSessionPorts,
  WizardEditorNoteValueSessionPorts,
} from '@wizard-archive/editor/adapter'

type InMemoryNoteItemWithContent = WizardEditorNoteCollaborationSessionRequest['note']

type InMemoryYjsProviderEvents = {
  sync: (synced: boolean) => void
}

type InMemoryNoteEditorSessionEntry = {
  destroy: () => void
  session: WizardEditorNoteEditorSession
}

type NoteContentChangeHandler = (input: { body: string; noteId: SidebarItemId }) => void

export function useInMemoryNoteSessionSource({
  onNoteContentChange,
  user,
}: {
  onNoteContentChange?: NoteContentChangeHandler
  user: { color: string; name: string }
}): WizardEditorNoteSessionPorts {
  const sessionsRef = useRef(new Map<string, InMemoryNoteEditorSessionEntry>())
  const noteSessionRef = useRef<WizardEditorNoteSessionPorts | null>(null)
  const onNoteContentChangeRef = useRef(onNoteContentChange)
  const userRef = useRef(user)
  onNoteContentChangeRef.current = onNoteContentChange
  userRef.current = user

  useEffect(() => {
    const sessions = sessionsRef.current
    return () => {
      sessions.forEach((entry) => entry.destroy())
      sessions.clear()
    }
  }, [])

  if (!noteSessionRef.current) {
    noteSessionRef.current = {
      document: {
        useCollaborationSession: (request) => {
          const sessionKey = noteCollaborationSessionKey(request)
          let entry = sessionsRef.current.get(sessionKey)
          if (!entry) {
            entry = createInMemoryNoteEditorSession({
              onContentChange: (input) => onNoteContentChangeRef.current?.(input),
              request,
              user: userRef.current,
            })
            sessionsRef.current.set(sessionKey, entry)
          } else if (
            entry.session.user.name !== userRef.current.name ||
            entry.session.user.color !== userRef.current.color
          ) {
            if (entry.session.status === 'ready') entry.session.updateUser?.(userRef.current)
            entry.session = {
              ...entry.session,
              user: userRef.current,
            }
          }
          return entry.session
        },
      },
    }
  }

  return noteSessionRef.current
}

export function useInMemoryNoteHeadingSessionPorts(): WizardEditorNoteHeadingSessionPorts {
  const noteHeadingsRef = useRef<WizardEditorNoteHeadingSessionPorts | null>(null)

  if (!noteHeadingsRef.current) {
    noteHeadingsRef.current = {
      headings: {
        useNoteHeadings: () => ({ headings: [], status: 'success' }),
      },
    }
  }

  return noteHeadingsRef.current
}

export function useInMemoryNotePlaybackSessionPorts({
  collaborationPlayback,
}: {
  collaborationPlayback?: WizardEditorNoteCollaborationPlayback
}): WizardEditorNotePlaybackSessionPorts {
  const collaborationPlaybackRef = useRef(collaborationPlayback)
  const notePlaybackRef = useRef<WizardEditorNotePlaybackSessionPorts | null>(null)
  collaborationPlaybackRef.current = collaborationPlayback

  if (!notePlaybackRef.current) {
    notePlaybackRef.current = {
      playback: {
        getCollaborationPlayback: (noteId) => {
          const playback = collaborationPlaybackRef.current
          return playback?.noteId === noteId ? playback : undefined
        },
      },
    }
  }

  return notePlaybackRef.current
}

export function useInMemoryNoteValueSessionPorts(): WizardEditorNoteValueSessionPorts {
  const noteValuesRef = useRef<WizardEditorNoteValueSessionPorts | null>(null)

  if (!noteValuesRef.current) {
    noteValuesRef.current = {
      values: {
        useNoteValueStates: () => ({ states: [], status: 'success' }),
      },
    }
  }

  return noteValuesRef.current
}

function createInMemoryNoteEditorSession({
  onContentChange,
  request,
  user,
}: {
  onContentChange: NoteContentChangeHandler
  request: WizardEditorNoteCollaborationSessionRequest
  user: WizardEditorNoteEditorSession['user']
}): InMemoryNoteEditorSessionEntry {
  const { mode, note } = request
  const doc = createWizardEditorNoteYDocFromContent(note.content)
  const handleUpdate = () => {
    if (mode !== 'editable') return
    onContentChange({ noteId: note.id, body: readWizardEditorNoteYDocMarkdown(doc) })
  }
  doc.on('update', handleUpdate)
  const provider = new InMemoryYjsProvider(doc)
  const collaborationProvider: YjsCollaborationProvider = {
    awareness: provider.awareness,
    destroy: () => provider.destroy(),
    doc,
    emit: provider.emit.bind(provider),
    flushPendingUpdates: () => Promise.resolve(true),
    flushUpdates: () => Promise.resolve(),
    isApplyingRemoteUpdate: () => false,
    off: provider.off.bind(provider),
    on: provider.on.bind(provider),
    updateUser: (nextUser) => provider.awareness.setLocalStateField('user', nextUser),
  }

  return {
    destroy: () => {
      doc.off('update', handleUpdate)
      provider.destroy()
      doc.destroy()
    },
    session: {
      engine: { doc, provider: collaborationProvider },
      instanceId: `in-memory-note:${note.id}`,
      mode,
      status: 'ready',
      updateUser: (nextUser) => provider.awareness.setLocalStateField('user', nextUser),
      user,
    },
  }
}

function noteCollaborationSessionKey({
  mode,
  note,
}: {
  mode: WizardEditorNoteCollaborationSessionMode
  note: InMemoryNoteItemWithContent
}) {
  return `${mode}:${note.id}`
}

class InMemoryYjsProvider {
  readonly awareness: Awareness
  private destroyed = false
  private readonly syncHandlers = new Set<InMemoryYjsProviderEvents['sync']>()

  constructor(readonly doc: Doc) {
    this.awareness = new Awareness(doc)
    queueMicrotask(() => {
      if (!this.destroyed) {
        this.emit('sync', [true])
      }
    })
  }

  on(_name: 'sync', handler: InMemoryYjsProviderEvents['sync']) {
    this.syncHandlers.add(handler)
  }

  off(_name: 'sync', handler: InMemoryYjsProviderEvents['sync']) {
    this.syncHandlers.delete(handler)
  }

  emit(_name: 'sync', args: [boolean]) {
    this.syncHandlers.forEach((handler) => handler(...args))
  }

  destroy() {
    if (this.destroyed) return

    this.destroyed = true
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'in-memory-disconnect')
    this.awareness.destroy()
    this.syncHandlers.clear()
  }
}
