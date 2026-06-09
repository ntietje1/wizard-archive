import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useLiveWikiLinkAutocompleteModelData } from '../use-live-wiki-link-autocomplete-source'
import { NoteValueRuntimeContext } from '~/features/editor/value-block/value-block-runtime-context'
import type { ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteValueRuntimeContextValue } from '~/features/editor/value-block/value-block-runtime-context'
import type { NoteValueRuntimeState } from 'shared/note-values/types'

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
  useCampaignQueryMock.mockReturnValue({ data: [], isPending: false })
  useFilteredSidebarItemsMock.mockReset()
  useFilteredSidebarItemsMock.mockReturnValue({
    data: [],
    ...buildSidebarItemMaps([]),
  })
})

describe('useLiveWikiLinkAutocompleteModelData', () => {
  it('loads headings for a resolved heading autocomplete target', () => {
    const targetNote = createNote({
      _id: 'target-note' as Id<'sidebarItems'>,
      name: 'Target Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [targetNote],
      ...buildSidebarItemMaps([targetNote]),
    })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteId' in args) {
        return {
          data: [
            {
              blockNoteId: 'heading-1',
              text: 'Opening Scene',
              normalizedText: 'opening scene',
              level: 2,
            },
          ],
          isPending: false,
        }
      }
      return { data: [], isPending: false }
    })

    const { result } = renderHook(() =>
      useLiveWikiLinkAutocompleteModelData({
        menu: { show: true, query: 'Target Note#', pos: null },
      }),
    )

    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), {
      noteId: targetNote._id,
    })
    expect(result.current.model.mode).toBe('heading')
    expect(result.current.model.suggestions).toEqual([
      expect.objectContaining({ title: 'Opening Scene' }),
    ])
  })

  it('loads persisted values for an external value autocomplete target', () => {
    const sourceNote = createNote({
      _id: 'source-note' as Id<'sidebarItems'>,
      name: 'Source Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const externalValue = runtimeState({
      noteId: sourceNote._id,
      valueId: 'source-value',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [sourceNote],
      ...buildSidebarItemMaps([sourceNote]),
    })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteId' in args) {
        return { data: [externalValue], isPending: false }
      }
      return { data: [], isPending: false }
    })

    const { result } = renderHook(() =>
      useLiveWikiLinkAutocompleteModelData({
        menu: { show: true, query: 'Source Note.', pos: null },
      }),
    )

    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), {
      noteId: sourceNote._id,
    })
    expect(result.current.model.mode).toBe('value')
    expect(result.current.model.suggestions).toEqual([
      expect.objectContaining({ slug: 'prof_bonus', formattedValue: '2' }),
    ])
  })

  it('uses runtime-authored values for the current note without loading persisted values', () => {
    const currentNote = createNote({
      _id: 'current-note' as Id<'sidebarItems'>,
      name: 'Current Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const currentValue = runtimeState({
      noteId: currentNote._id,
      valueId: 'current-value',
      slug: 'draft_value',
      formattedValue: '10',
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [currentNote],
      ...buildSidebarItemMaps([currentNote]),
    })

    const { result } = renderHook(
      () =>
        useLiveWikiLinkAutocompleteModelData({
          menu: { show: true, query: 'Current Note.', pos: null },
          sourceNoteId: currentNote._id,
        }),
      { wrapper: createValueRuntimeWrapper(currentNote._id, [currentValue]) },
    )

    expect(useCampaignQueryMock).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(result.current.model.mode).toBe('value')
    expect(result.current.model.suggestions).toEqual([
      expect.objectContaining({ slug: 'draft_value', formattedValue: '10' }),
    ])
  })
})

function createValueRuntimeWrapper(
  noteId: Id<'sidebarItems'>,
  authoredValueStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>,
) {
  const value: NoteValueRuntimeContextValue = {
    noteId,
    editable: true,
    authoredDefinitions: [],
    authoredValueStates,
    stateByValueId: new Map(authoredValueStates.map((state) => [state.valueId, state])),
    sidebarItems: [],
    itemsMap: new Map(),
  }
  return function ValueRuntimeWrapper({ children }: { children: ReactNode }) {
    return (
      <NoteValueRuntimeContext.Provider value={value}>{children}</NoteValueRuntimeContext.Provider>
    )
  }
}

function runtimeState(
  overrides: Partial<NoteValueRuntimeState<Id<'sidebarItems'>>> = {},
): NoteValueRuntimeState<Id<'sidebarItems'>> {
  return {
    noteId: 'note-1' as Id<'sidebarItems'>,
    blockNoteId: 'block-1',
    valueId: 'value-1',
    slug: 'draft_value',
    status: 'ok',
    rawValue: 1,
    formattedValue: '1',
    errorCode: null,
    errorMessage: null,
    ...overrides,
  }
}
