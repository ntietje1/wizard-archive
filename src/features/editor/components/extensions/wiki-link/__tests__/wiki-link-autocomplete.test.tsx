import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { WikiLinkAutocomplete } from '../wiki-link-autocomplete'
import {
  buildWikiLinkAutocompleteModel,
  getWikiLinkAutocompleteContext,
} from '../wiki-link-autocomplete-model'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteValueRuntimeState } from 'shared/note-values/types'
import type {
  WikiLinkAutocompleteMenuState,
  WikiLinkAutocompleteModelData,
} from '../wiki-link-autocomplete-source'

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

function createAutocompleteModelData({
  sidebarItems,
  values = [],
}: {
  sidebarItems: Array<AnySidebarItem>
  values?: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
}): (args: {
  menu: WikiLinkAutocompleteMenuState
  sourceNoteId?: Id<'sidebarItems'>
}) => WikiLinkAutocompleteModelData {
  return ({ menu, sourceNoteId }) => {
    const { itemsMap } = buildSidebarItemMaps(sidebarItems)
    const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined
    const context = menu.show
      ? getWikiLinkAutocompleteContext(menu.query, sidebarItems, itemsMap, sourceParentId)
      : null
    return {
      context,
      headingsPending: false,
      model: buildWikiLinkAutocompleteModel({
        context,
        sidebarItems,
        itemsMap,
        headings: [],
        values,
      }),
      valuesPending: false,
    }
  }
}

function TestWikiLinkAutocomplete({
  editor,
  sourceNoteId,
  getModelData,
}: {
  editor: CustomBlockNoteEditor | undefined
  sourceNoteId?: Id<'sidebarItems'>
  getModelData: (args: {
    menu: WikiLinkAutocompleteMenuState
    sourceNoteId?: Id<'sidebarItems'>
  }) => WikiLinkAutocompleteModelData
}) {
  const [menu, setMenu] = useState<WikiLinkAutocompleteMenuState>({
    show: false,
    query: '',
    pos: null,
  })
  const modelData = getModelData({ menu, sourceNoteId })

  return (
    <WikiLinkAutocomplete
      editor={editor}
      menu={menu}
      modelData={modelData}
      setMenu={setMenu}
      sourceNoteId={sourceNoteId}
    />
  )
}

describe('WikiLinkAutocomplete', () => {
  it('suggests only sidebar items from the permission-filtered list', async () => {
    const visibleNote = createNote({
      name: 'Visible Note',
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const { editor, openAutocomplete } = createEditorStub()
    render(
      <TestWikiLinkAutocomplete
        editor={editor}
        getModelData={createAutocompleteModelData({ sidebarItems: [visibleNote] })}
      />,
    )

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

    const { editor, openAutocomplete } = createEditorStub('[[Current Note.')
    const currentNoteValue: NoteValueRuntimeState<Id<'sidebarItems'>> = {
      noteId: currentNote._id,
      blockNoteId: 'block-1',
      valueId: 'value-1',
      slug: 'draft_value',
      status: 'ok',
      rawValue: 1,
      formattedValue: '1',
      errorCode: null,
      errorMessage: null,
    }
    render(
      <TestWikiLinkAutocomplete
        editor={editor}
        getModelData={createAutocompleteModelData({
          sidebarItems: [currentNote],
          values: [currentNoteValue],
        })}
        sourceNoteId={currentNote._id}
      />,
    )

    act(() => {
      openAutocomplete()
    })

    expect(await screen.findByRole('option', { name: /draft_value/ })).toBeInTheDocument()
  })
})
