import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { applyUpdate, encodeStateAsUpdate } from 'yjs'
import type { SidebarItemId } from 'shared/common/ids'
import { createWizardEditorNoteYDocFromContent } from '@wizard-archive/editor/adapter'
import type {
  WizardEditorNoteCollaborationSessionRequest,
  WizardEditorNoteSessionPorts,
} from '@wizard-archive/editor/adapter'
import { createNote } from '../../../test/factories/sidebar-item-factory'
import { useInMemoryNoteSessionSource } from '../in-memory-note-session-source'

type TestNoteItemWithContent = WizardEditorNoteCollaborationSessionRequest['note']

describe('useInMemoryNoteSessionSource', () => {
  it('keeps editable note sessions stable across editor remounts with collaboration awareness', async () => {
    const note = createContentNote('note-1')
    const { result, rerender, unmount } = renderHook(() =>
      useInMemoryNoteSessionSource({
        user: { name: 'Demo', color: '#61afef' },
      }),
    )

    const firstSession = result.current.document.useCollaborationSession({ mode: 'editable', note })
    const firstReadySession = expectReadyNoteSession(firstSession)
    const syncHandler = vi.fn()
    firstReadySession.engine.provider.on('sync', syncHandler)

    rerender()
    await Promise.resolve()

    expect(result.current.document.useCollaborationSession({ mode: 'editable', note })).toBe(
      firstSession,
    )
    expect(firstSession.status).toBe('ready')
    expect(firstReadySession.engine.doc).not.toBeNull()
    expect(firstReadySession.engine.provider.awareness).toBeDefined()
    expect(syncHandler).toHaveBeenCalledWith(true)
    firstReadySession.updateUser?.({ name: 'Viewer', color: '#c678dd' })
    expect(firstReadySession.engine.provider.awareness.getLocalState()?.user).toEqual({
      name: 'Viewer',
      color: '#c678dd',
    })
    unmount()
    firstReadySession.engine.provider.emit('sync', [true])
    expect(syncHandler).toHaveBeenCalledTimes(1)
  })

  it('reports editable Yjs document changes as exportable local note body updates', async () => {
    const note = { ...createContentNote('note-1'), content: [] }
    const onNoteContentChange = vi.fn()
    const { result } = renderHook(() =>
      useInMemoryNoteSessionSource({
        onNoteContentChange,
        user: { name: 'Demo', color: '#61afef' },
      }),
    )
    const session = result.current.document.useCollaborationSession({ mode: 'editable', note })
    const doc = expectReadyNoteSession(session).engine.doc
    const nextDoc = createWizardEditorNoteYDocFromContent([
      {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Updated local note body', styles: {} }],
        children: [],
      },
    ])

    try {
      applyUpdate(doc, encodeStateAsUpdate(nextDoc))

      await waitFor(() =>
        expect(onNoteContentChange).toHaveBeenCalledWith({
          noteId: 'note-1',
          body: expect.stringContaining('Updated local note body'),
        }),
      )
    } finally {
      nextDoc.destroy()
    }
  })

  it('updates cached editable note sessions to the current local user', () => {
    const note = createContentNote('note-1')
    const { result, rerender } = renderHook(
      ({ user }) =>
        useInMemoryNoteSessionSource({
          user,
        }),
      {
        initialProps: {
          user: { name: 'Demo', color: '#61afef' },
        },
      },
    )

    const firstSession = result.current.document.useCollaborationSession({ mode: 'editable', note })

    rerender({ user: { name: 'Viewer', color: '#c678dd' } })
    const nextSession = result.current.document.useCollaborationSession({ mode: 'editable', note })
    const firstReadySession = expectReadyNoteSession(firstSession)
    const nextReadySession = expectReadyNoteSession(nextSession)

    expect(nextReadySession.engine.doc).toBe(firstReadySession.engine.doc)
    expect(nextReadySession.engine.provider).toBe(firstReadySession.engine.provider)
    expect(nextSession.user).toEqual({ name: 'Viewer', color: '#c678dd' })
    expect(nextReadySession.engine.provider.awareness.getLocalState()?.user).toEqual({
      name: 'Viewer',
      color: '#c678dd',
    })
  })

  it('keeps readonly collaboration sessions separate from editable local persistence', async () => {
    const note = createContentNote('note-1')
    const onNoteContentChange = vi.fn()
    const { result } = renderHook(() =>
      useInMemoryNoteSessionSource({
        onNoteContentChange,
        user: { name: 'Demo', color: '#61afef' },
      }),
    )

    const editableSession = result.current.document.useCollaborationSession({
      mode: 'editable',
      note,
    })
    const readonlySession = result.current.document.useCollaborationSession({
      mode: 'readonly',
      note,
    })
    expect(readonlySession).not.toBe(editableSession)
    expect(readonlySession.mode).toBe('readonly')

    const doc = expectReadyNoteSession(readonlySession).engine.doc
    const nextDoc = createWizardEditorNoteYDocFromContent([
      {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Readonly local note body', styles: {} }],
        children: [],
      },
    ])

    try {
      applyUpdate(doc, encodeStateAsUpdate(nextDoc))
      await Promise.resolve()
      expect(onNoteContentChange).not.toHaveBeenCalled()
    } finally {
      nextDoc.destroy()
    }
  })
})

function createContentNote(id: string): TestNoteItemWithContent {
  return {
    ...createNote({ id: id as SidebarItemId }),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello', styles: {} }],
        children: [],
      },
    ],
  }
}

function expectReadyNoteSession(
  session: ReturnType<WizardEditorNoteSessionPorts['document']['useCollaborationSession']>,
) {
  if (session.status !== 'ready') {
    throw new Error(`expected ready note session, received ${session.status}`)
  }
  return session
}
