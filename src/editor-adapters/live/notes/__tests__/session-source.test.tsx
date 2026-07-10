import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  useLiveImportedTextFileInitializer,
  useLiveNoteHeadingSessionPorts,
  useLiveNoteSessionPorts,
  useLiveNoteValueSessionPorts,
} from '~/editor-adapters/live/notes/session-source'
import type { Id } from 'convex/_generated/dataModel'
import type { WizardEditorNoteCollaborationSessionRequest } from '@wizard-archive/editor/adapter'
import type { SidebarItemId } from 'shared/common/ids'
import { createNote } from '~/test/factories/sidebar-item-factory'

const noteDoc = vi.hoisted(() => ({ getXmlFragment: vi.fn() }))
type TestNoteItemWithContent = WizardEditorNoteCollaborationSessionRequest['note']

const {
  useAuthQueryMock,
  useCampaignMutationMock,
  useCampaignQueryMock,
  useNoteYjsCollaborationMock,
} = vi.hoisted(() => ({
  useAuthQueryMock: vi.fn(),
  useCampaignMutationMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
  useNoteYjsCollaborationMock: vi.fn(),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (...args: Array<unknown>) => useCampaignMutationMock(...args),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: (...args: Array<unknown>) => useAuthQueryMock(...args),
}))

vi.mock('~/editor-adapters/live/notes/yjs-collaboration', () => ({
  useNoteYjsCollaboration: (...args: Array<unknown>) => useNoteYjsCollaborationMock(...args),
}))

beforeEach(() => {
  useAuthQueryMock.mockReset()
  useCampaignMutationMock.mockReset()
  useCampaignQueryMock.mockReset()
  useNoteYjsCollaborationMock.mockReset()
  noteDoc.getXmlFragment.mockClear()
  useAuthQueryMock.mockReturnValue({
    data: { id: 'user_1', name: 'Mina', username: 'mina' },
    isLoading: false,
  })
  useCampaignMutationMock.mockReturnValue({ mutateAsync: vi.fn() })
  useCampaignQueryMock.mockReturnValue({ data: [], isPending: false })
  useNoteYjsCollaborationMock.mockReturnValue({
    doc: noteDoc,
    error: null,
    instanceId: 'note-session-1',
    isLoading: false,
    provider: null,
  })
})

describe('live note session source note data', () => {
  it('loads headings and note value states through source-neutral data hooks', () => {
    const headingsNoteId = 'headings-note' as Id<'sidebarItems'>
    const persistedValuesNoteId = 'values-note' as Id<'sidebarItems'>
    const persistedValue = runtimeState({
      noteId: persistedValuesNoteId,
      valueId: 'source-value',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteId' in args) {
        if (args.noteId === headingsNoteId) {
          return {
            data: [
              {
                noteBlockId: 'heading-1',
                text: 'Opening Scene',
                normalizedText: 'opening scene',
                level: 2,
              },
            ],
            isPending: false,
          }
        }
      }
      if (args && typeof args === 'object' && 'noteIds' in args) {
        return { data: [persistedValue], status: 'success' }
      }
      return { data: [], isPending: false }
    })

    const sessionSource = renderHook(() => {
      const headings = useLiveNoteHeadingSessionPorts()
      const values = useLiveNoteValueSessionPorts()
      return {
        headings: headings.headings.useNoteHeadings(headingsNoteId),
        values: values.values.useNoteValueStates([persistedValuesNoteId]),
      }
    })

    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), {
      noteId: headingsNoteId,
    })
    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), {
      noteIds: [persistedValuesNoteId],
    })
    expect(sessionSource.result.current.headings.headings).toEqual([
      expect.objectContaining({ text: 'Opening Scene' }),
    ])
    expect(sessionSource.result.current.values.states).toEqual([
      expect.objectContaining({ slug: 'prof_bonus', formattedValue: '2' }),
    ])
  })

  it('hydrates note data only for persisted note ids', () => {
    const headingsNoteId = 'optimistic-headings-note' as SidebarItemId
    const optimisticValuesNoteId = 'optimistic-values-note' as SidebarItemId
    const persistedValuesNoteId = 'values-note' as Id<'sidebarItems'>
    const persistedValue = runtimeState({
      noteId: persistedValuesNoteId,
      valueId: 'source-value',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteIds' in args) {
        return { data: [persistedValue], status: 'success' }
      }
      return { data: [], status: 'success' }
    })

    const sessionSource = renderHook(() => {
      const headings = useLiveNoteHeadingSessionPorts()
      const values = useLiveNoteValueSessionPorts()
      return {
        headings: headings.headings.useNoteHeadings(headingsNoteId),
        values: values.values.useNoteValueStates([optimisticValuesNoteId, persistedValuesNoteId]),
      }
    })

    const queryArgs = useCampaignQueryMock.mock.calls.map(([, args]) => args)
    expect(queryArgs).toContain('skip')
    expect(queryArgs).toContainEqual({ noteIds: [persistedValuesNoteId] })
    expect(sessionSource.result.current.headings).toEqual({
      headings: [],
      status: 'success',
    })
    expect(sessionSource.result.current.values.states).toEqual([
      expect.objectContaining({ noteId: persistedValuesNoteId, slug: 'prof_bonus' }),
    ])
  })

  it('initializes imported text through live note persistence', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ status: 'accepted', seq: 1 })
    useCampaignMutationMock.mockReturnValue({ mutateAsync })
    const file = {
      name: 'Session notes.txt',
      contentType: 'text/plain',
      size: 13,
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      text: vi.fn(() => Promise.resolve('Opening scene')),
    }

    const initializer = renderHook(() => useLiveImportedTextFileInitializer())

    await initializer.result.current({
      file,
      noteId: 'note_1' as Id<'sidebarItems'>,
    })

    expect(mutateAsync).toHaveBeenCalledWith({
      documentId: 'note_1',
      revision: 0,
      update: expect.any(ArrayBuffer),
      content: [
        expect.objectContaining({
          type: 'paragraph',
          content: [expect.objectContaining({ text: 'Opening scene' })],
        }),
      ],
    })
  })

  it('keeps editable note sessions loading while the live user profile hydrates', () => {
    useAuthQueryMock.mockReturnValue({ data: undefined, isLoading: true })
    const note = createContentNote()

    const session = renderHook(() => {
      const source = useLiveNoteSessionPorts({
        canEditNote: () => true,
        getNoteSlugById: () => null,
        workspaceId: 'campaign_1',
      })
      return source.document.useCollaborationSession({ mode: 'editable', note })
    })

    expect(session.result.current).toMatchObject({
      mode: 'editable',
      status: 'loading',
      user: expect.objectContaining({ name: 'Anonymous' }),
    })
    expect(useNoteYjsCollaborationMock).toHaveBeenCalledWith(
      'campaign_1',
      note.id,
      expect.objectContaining({ name: 'Anonymous' }),
      true,
      { getNoteSlugById: expect.any(Function) },
    )
  })

  it('keeps optimistic notes out of live collaboration paths', () => {
    const note = createContentNote('optimistic-note' as SidebarItemId)
    const canEditNote = vi.fn(() => true)

    const session = renderHook(() => {
      const source = useLiveNoteSessionPorts({
        canEditNote,
        getNoteSlugById: () => null,
        workspaceId: 'campaign_1',
      })
      return source.document.useCollaborationSession({ mode: 'editable', note })
    })

    expect(session.result.current).toMatchObject({
      reason: 'optimistic_resource_pending',
      status: 'unavailable',
    })
    expect(canEditNote).not.toHaveBeenCalled()
    expect(useNoteYjsCollaborationMock).toHaveBeenCalledWith(
      null,
      note.id,
      expect.objectContaining({ name: 'Mina' }),
      false,
      { getNoteSlugById: expect.any(Function) },
    )
  })

  it('does not enable note edits when item permission is readonly', () => {
    const note = createContentNote()
    const canEditNote = vi.fn(() => false)

    renderHook(() => {
      const source = useLiveNoteSessionPorts({
        canEditNote,
        getNoteSlugById: () => null,
        workspaceId: 'campaign_1',
      })
      return source.document.useCollaborationSession({ mode: 'editable', note })
    })

    expect(canEditNote).toHaveBeenCalledWith(note)
    expect(useNoteYjsCollaborationMock).toHaveBeenCalledWith(
      'campaign_1',
      note.id,
      expect.objectContaining({ name: 'Mina' }),
      false,
      { getNoteSlugById: expect.any(Function) },
    )
  })

  it('does not enable note edits for readonly collaboration session mode', () => {
    const note = createContentNote()

    const session = renderHook(() => {
      const source = useLiveNoteSessionPorts({
        canEditNote: () => true,
        getNoteSlugById: () => null,
        workspaceId: 'campaign_1',
      })
      return source.document.useCollaborationSession({ mode: 'readonly', note })
    })

    expect(session.result.current.mode).toBe('readonly')
    expect(useNoteYjsCollaborationMock).toHaveBeenCalledWith(
      'campaign_1',
      note.id,
      expect.objectContaining({ name: 'Mina' }),
      false,
      { getNoteSlugById: expect.any(Function) },
    )
  })
})

function runtimeState(overrides: Record<string, unknown> = {}) {
  return {
    noteId: 'note-1' as Id<'sidebarItems'>,
    blockNoteId: 'block-1',
    valueId: 'value-1',
    slug: 'draft_value',
    status: 'ok',
    rawValue: 1,
    formattedValue: '1',
    ...overrides,
  }
}

function createContentNote(
  id: SidebarItemId = 'note_1' as Id<'sidebarItems'>,
): TestNoteItemWithContent {
  return {
    ...createNote({ id }),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  }
}
