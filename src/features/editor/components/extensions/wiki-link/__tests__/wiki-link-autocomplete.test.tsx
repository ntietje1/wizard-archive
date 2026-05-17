import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { WikiLinkAutocomplete } from '../wiki-link-autocomplete'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

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

function createEditorStub() {
  const domElement = document.createElement('div')
  document.body.append(domElement)
  let transactionHandler: ((payload: { transaction: { docChanged: boolean } }) => void) | null =
    null

  const editor = {
    domElement,
    _tiptapEditor: {
      state: {
        selection: {
          from: 2,
          $from: {
            start: () => 0,
            end: () => 2,
          },
        },
        doc: {
          textBetween: (from: number, to: number) => (from === 0 && to === 2 ? '[[' : ''),
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
})
