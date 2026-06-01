import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { WikiLinkAutocomplete } from '../wiki-link-autocomplete'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { NoteValueRuntimeContext } from '~/features/editor/value-block/value-block-runtime-context'
import type { Id } from 'convex/_generated/dataModel'

const filteredSidebarItemsMock = vi.hoisted(() => vi.fn())
const activeSidebarItemsMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => filteredSidebarItemsMock(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeSidebarItemsMock(),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: () => ({ data: [], isPending: false }),
}))

function sidebarValue(data: Array<AnySidebarItem>) {
  return {
    data,
    status: 'success',
    ...buildSidebarItemMaps(data),
  }
}

function createEditorStub(text = '[[') {
  const domElement = document.createElement('div')
  document.body.append(domElement)
  let transactionHandler: ((payload: { transaction: { docChanged: boolean } }) => void) | null =
    null

  const editor = {
    domElement,
    _tiptapEditor: {
      state: {
        selection: {
          from: text.length,
          $from: {
            start: () => 0,
            end: () => text.length,
          },
        },
        doc: {
          textBetween: (from: number, to: number) => text.slice(from, to),
        },
      },
      view: {
        coordsAtPos: () => ({ left: 10, top: 10, bottom: 24 }),
      },
      on: vi.fn((event: string, handler: typeof transactionHandler) => {
        if (event === 'transaction') transactionHandler = handler
      }),
      off: vi.fn(),
    },
  } as unknown as CustomBlockNoteEditor

  return {
    editor,
    openAutocomplete: () => transactionHandler?.({ transaction: { docChanged: true } }),
  }
}

describe('WikiLinkAutocomplete', () => {
  it('suggests only sidebar items from the permission-filtered list', async () => {
    const visibleNote = createNote({
      name: 'Visible Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hiddenNote = createNote({
      name: 'Hidden Note',
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })

    activeSidebarItemsMock.mockReturnValue(sidebarValue([visibleNote, hiddenNote]))
    filteredSidebarItemsMock.mockReturnValue(sidebarValue([visibleNote]))

    const { editor, openAutocomplete } = createEditorStub()
    render(<WikiLinkAutocomplete editor={editor} />)

    act(() => {
      openAutocomplete()
    })

    expect(await screen.findByText('Visible Note')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Hidden Note')).not.toBeInTheDocument()
    })
  })

  it('uses live current-note values for qualified value autocomplete', async () => {
    const currentNote = createNote({
      _id: 'note-1' as Id<'sidebarItems'>,
      name: 'Current Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    activeSidebarItemsMock.mockReturnValue(sidebarValue([currentNote]))
    filteredSidebarItemsMock.mockReturnValue(sidebarValue([currentNote]))

    const { editor, openAutocomplete } = createEditorStub('[[Current Note.')
    render(
      <NoteValueRuntimeContext.Provider
        value={{
          noteId: currentNote._id,
          editable: true,
          authoredDefinitions: [
            {
              noteId: currentNote._id,
              blockNoteId: 'block-1',
              valueId: 'value-1',
              slug: 'draft_value',
              expressionSource: '1',
            },
          ],
          authoredValueStates: [
            {
              noteId: currentNote._id,
              blockNoteId: 'block-1',
              valueId: 'value-1',
              slug: 'draft_value',
              status: 'ok',
              rawValue: 1,
              formattedValue: '1',
              errorCode: null,
              errorMessage: null,
            },
          ],
          stateByValueId: new Map([
            [
              'value-1',
              {
                noteId: currentNote._id,
                blockNoteId: 'block-1',
                valueId: 'value-1',
                slug: 'draft_value',
                status: 'ok',
                rawValue: 1,
                formattedValue: '1',
                errorCode: null,
                errorMessage: null,
              },
            ],
          ]),
          sidebarItems: [currentNote],
          itemsMap: new Map([[currentNote._id, currentNote]]),
        }}
      >
        <WikiLinkAutocomplete editor={editor} sourceNoteId={currentNote._id} />
      </NoteValueRuntimeContext.Provider>,
    )

    act(() => {
      openAutocomplete()
    })

    expect(await screen.findByRole('option', { name: /draft_value/ })).toBeInTheDocument()
  })
})
