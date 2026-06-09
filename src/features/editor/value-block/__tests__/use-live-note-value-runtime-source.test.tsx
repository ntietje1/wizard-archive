import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import { useLiveNoteValueRuntimeSource } from '../use-live-note-value-runtime-source'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteValueRuntimeState } from '../../../../../shared/note-values/types'

const { useCampaignQueryMock, useFilteredSidebarItemsMock } = vi.hoisted(() => ({
  useCampaignQueryMock: vi.fn(),
  useFilteredSidebarItemsMock: vi.fn(),
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => useFilteredSidebarItemsMock(),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

beforeEach(() => {
  useCampaignQueryMock.mockReset()
  useCampaignQueryMock.mockReturnValue({ data: [], status: 'success' })
  useFilteredSidebarItemsMock.mockReset()
  useFilteredSidebarItemsMock.mockReturnValue({ data: [], itemsMap: new Map() })
})

describe('useLiveNoteValueRuntimeSource', () => {
  it('extracts editor definitions and loads current plus referenced external value states', () => {
    const noteId = testId<'sidebarItems'>('note-1')
    const currentNote = createNote({ _id: noteId, name: 'Current Note', slug: 'current-note' })
    const sourceNote = createNote({
      _id: testId<'sidebarItems'>('note-2'),
      name: 'Source Note',
      slug: 'source-note',
    })
    const persistedState = runtimeState({ noteId, valueId: 'value-1', formattedValue: '100' })
    const externalState = runtimeState({
      noteId: sourceNote._id,
      valueId: 'source-value-1',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [currentNote, sourceNote],
      itemsMap: new Map([
        [currentNote._id, currentNote],
        [sourceNote._id, sourceNote],
      ]),
    })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteIds' in args) {
        return { data: [externalState], status: 'success' }
      }
      if (args && typeof args === 'object' && 'noteId' in args) {
        return { data: [persistedState], status: 'success' }
      }
      return { data: [], status: 'success' }
    })

    const { result } = renderHook(() =>
      useLiveNoteValueRuntimeSource({
        editor: createEditor('[[Source Note.prof_bonus]] + 1'),
        noteId,
      }),
    )

    expect(result.current.noteId).toBe(noteId)
    expect(result.current.authoredDefinitions).toEqual([
      expect.objectContaining({
        noteId,
        valueId: 'value-1',
        slug: 'draft_total',
        expressionSource: '[[Source Note.prof_bonus]] + 1',
      }),
    ])
    expect(result.current.externalNoteIdByPath).toEqual(new Map([['Source Note', sourceNote._id]]))
    expect(result.current.persistedStates).toEqual([persistedState])
    expect(result.current.externalStates).toEqual([externalState])
    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), { noteId })
    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), {
      noteIds: [sourceNote._id],
    })
  })

  it('does not query hidden external notes missing from the filtered sidebar source', () => {
    const noteId = testId<'sidebarItems'>('note-1')
    const currentNote = createNote({ _id: noteId, name: 'Current Note', slug: 'current-note' })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [currentNote],
      itemsMap: new Map([[currentNote._id, currentNote]]),
    })

    const { result } = renderHook(() =>
      useLiveNoteValueRuntimeSource({
        editor: createEditor('[[Hidden Note.prof_bonus]] + 1'),
        noteId,
      }),
    )

    expect(result.current.externalNoteIdByPath).toEqual(new Map())
    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), { noteId })
    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), 'skip')
  })
})

function createEditor(expressionSource: string): CustomBlockNoteEditor {
  return {
    document: [
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'draft_total',
              expressionSource,
            },
          },
        ],
        children: [],
      },
    ],
    _tiptapEditor: {
      on: vi.fn(),
      off: vi.fn(),
    },
  } as unknown as CustomBlockNoteEditor
}

function runtimeState(
  overrides: Partial<NoteValueRuntimeState<Id<'sidebarItems'>>> = {},
): NoteValueRuntimeState<Id<'sidebarItems'>> {
  return {
    noteId: testId<'sidebarItems'>('note-1'),
    blockNoteId: 'block-1',
    valueId: 'value-1',
    slug: 'draft_total',
    status: 'ok',
    rawValue: 3,
    formattedValue: '3',
    errorCode: null,
    errorMessage: null,
    ...overrides,
  }
}
