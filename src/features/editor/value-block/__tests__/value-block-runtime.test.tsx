import { beforeEach, describe, expect, it, vi } from 'vitest'
import { use, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Id } from 'convex/_generated/dataModel'
import type { Note } from 'shared/notes/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { NoteValueProps } from '../../../../../shared/note-values/schema'
import type {
  NoteValueAuthoringDefinition,
  NoteValueRuntimeState,
} from '../../../../../shared/note-values/types'
import {
  compileNoteValueDefinitions,
  evaluateNoteValueDefinitions,
} from '../../../../../shared/note-values/formula'
import { NoteValueRuntimeContext } from '../value-block-runtime-context'
import { NoteValueRuntimeProvider } from '../value-block-runtime'
import { ValueInlineContent } from '../value-block-spec'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const useActiveSidebarItemsMock = vi.hoisted(() => vi.fn())
const useFilteredSidebarItemsMock = vi.hoisted(() => vi.fn())

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => useActiveSidebarItemsMock(),
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => useFilteredSidebarItemsMock(),
}))

beforeEach(() => {
  useCampaignQueryMock.mockReturnValue({
    data: [],
    status: 'success',
  })
  useActiveSidebarItemsMock.mockReturnValue({
    data: [],
    itemsMap: new Map(),
  })
  useFilteredSidebarItemsMock.mockReturnValue({
    data: [],
    itemsMap: new Map(),
  })
})

function runtimeState(
  overrides: Partial<NoteValueRuntimeState<Id<'sidebarItems'>>> = {},
): NoteValueRuntimeState<Id<'sidebarItems'>> {
  return {
    noteId: 'note-1' as Id<'sidebarItems'>,
    blockNoteId: 'block-1',
    valueId: 'value-1',
    slug: 'prof_bonus',
    status: 'ok',
    rawValue: 3,
    formattedValue: '3',
    errorCode: null,
    errorMessage: null,
    ...overrides,
  }
}

function noteItem(id: Id<'sidebarItems'>, name: string): Note {
  return {
    _id: id,
    _creationTime: 1,
    name: name as Note['name'],
    iconName: null,
    color: null,
    slug: name.toLowerCase().replaceAll(' ', '-') as Note['slug'],
    campaignId: 'campaign-1' as Id<'campaigns'>,
    parentId: null,
    type: 'note',
    allPermissionLevel: null,
    location: 'sidebar',
    status: 'active',
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-1' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: 'full_access',
    previewUrl: null,
    isActive: true,
    isTrashed: false,
  }
}

function renderInlineValue({
  editable = true,
  updateInlineContent = vi.fn(),
  authoredDefinitions = [],
  runtimeStates = [runtimeState()],
  sidebarItems = [],
}: {
  editable?: boolean
  authoredDefinitions?: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  updateInlineContent?: (update: {
    type: 'value'
    props: { valueId: string; slug: string; expressionSource: string }
  }) => void
  runtimeStates?:
    | Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
    | ((props: NoteValueProps) => Array<NoteValueRuntimeState<Id<'sidebarItems'>>>)
  sidebarItems?: Array<AnySidebarItem>
} = {}) {
  function TestHarness() {
    const [props, setProps] = useState({
      valueId: 'value-1',
      slug: 'prof_bonus',
      expressionSource: '3',
    })
    const currentRuntimeStates =
      typeof runtimeStates === 'function' ? runtimeStates(props) : runtimeStates
    const updateValue = (nextInline: {
      type: 'value'
      props: { valueId: string; slug: string; expressionSource: string }
    }) => {
      setProps(nextInline.props)
      updateInlineContent(nextInline)
    }

    return (
      <NoteValueRuntimeContext.Provider
        value={{
          noteId: 'note-1' as Id<'sidebarItems'>,
          editable,
          authoredDefinitions,
          authoredValueStates: currentRuntimeStates,
          stateByValueId: new Map(currentRuntimeStates.map((state) => [state.valueId, state])),
          sidebarItems,
          itemsMap: new Map(sidebarItems.map((item) => [item._id, item])),
        }}
      >
        <ValueInlineContent
          inlineContent={{
            props,
          }}
          updateInlineContent={updateValue}
        />
      </NoteValueRuntimeContext.Provider>
    )
  }

  render(<TestHarness />)
  return { updateInlineContent }
}

function makeRuntimeProviderEditor(
  expressionSource: string,
  extraValues: Array<{
    valueId: string
    slug: string
    expressionSource: string
  }> = [],
): Parameters<typeof NoteValueRuntimeProvider>[0]['editor'] {
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
          ...extraValues.map((value) => ({
            type: 'value',
            props: {
              valueId: value.valueId,
              slug: value.slug,
              expressionSource: value.expressionSource,
            },
          })),
        ],
        children: [],
      },
    ],
    _tiptapEditor: {
      on: vi.fn(),
      off: vi.fn(),
    },
  } as unknown as Parameters<typeof NoteValueRuntimeProvider>[0]['editor']
}

function renderRuntimeProviderChip({
  expressionSource,
  evaluateValuesFromEditor = true,
  persistedStates,
  externalStates = [],
  sidebarItems = [],
  filteredSidebarItems = sidebarItems,
  extraValues = [],
}: {
  expressionSource: string
  evaluateValuesFromEditor?: boolean
  persistedStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  externalStates?: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  sidebarItems?: Array<AnySidebarItem>
  filteredSidebarItems?: Array<AnySidebarItem>
  extraValues?: Parameters<typeof makeRuntimeProviderEditor>[1]
}) {
  useActiveSidebarItemsMock.mockReturnValue({
    data: sidebarItems,
    itemsMap: new Map(sidebarItems.map((item) => [item._id, item])),
  })
  useFilteredSidebarItemsMock.mockReturnValue({
    data: filteredSidebarItems,
    itemsMap: new Map(filteredSidebarItems.map((item) => [item._id, item])),
  })
  useCampaignQueryMock.mockImplementation((_query, args) => {
    if (args && typeof args === 'object' && 'noteIds' in args) {
      return { data: externalStates, status: 'success' }
    }
    if (args && typeof args === 'object' && 'noteId' in args) {
      return { data: persistedStates, status: 'success' }
    }
    return { data: [], status: 'success' }
  })

  function RuntimeStateChip() {
    const { stateByValueId } = useNoteValueRuntimeForTest()
    const state = stateByValueId.get('value-1')
    return (
      <div data-testid="provider-value-state">
        {state?.status}:{state?.formattedValue}:{state?.errorMessage ?? ''}
      </div>
    )
  }

  render(
    <NoteValueRuntimeProvider
      editor={makeRuntimeProviderEditor(expressionSource, extraValues)}
      noteId={'note-1' as Id<'sidebarItems'>}
      editable={false}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
    >
      <RuntimeStateChip />
    </NoteValueRuntimeProvider>,
  )
}

function useNoteValueRuntimeForTest() {
  return use(NoteValueRuntimeContext)!
}

function evaluateTestDefinitions(
  definitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>,
) {
  const compiledDefinitions = compileNoteValueDefinitions(definitions, {
    currentNoteId: 'note-1' as Id<'sidebarItems'>,
    resolveExternal: () => ({
      ok: false,
      errorCode: 'unknown_reference',
      errorMessage: 'External references are not available in this test',
    }),
  })
  return evaluateNoteValueDefinitions(compiledDefinitions, () => null)
}

describe('inline value chip runtime', () => {
  it('evaluates changed external-reference drafts instead of showing stale persisted state', () => {
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')
    const sourceNote = noteItem('note-2' as Id<'sidebarItems'>, 'Source Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Source Note.prof_bonus]] + 1',
      sidebarItems: [currentNote, sourceNote],
      persistedStates: [
        runtimeState({
          valueId: 'value-1',
          slug: 'draft_total',
          rawValue: 100,
          formattedValue: '100',
        }),
      ],
      externalStates: [
        runtimeState({
          noteId: sourceNote._id,
          valueId: 'source-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
      ],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent('ok:3:')
    expect(screen.getByTestId('provider-value-state')).not.toHaveTextContent('100')
  })

  it('uses persisted states when a static editor has filtered content', () => {
    renderRuntimeProviderChip({
      expressionSource: '[[hidden_value]] + 1',
      evaluateValuesFromEditor: false,
      persistedStates: [
        runtimeState({
          valueId: 'value-1',
          slug: 'draft_total',
          rawValue: 100,
          formattedValue: '100',
        }),
      ],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent('ok:100:')
  })

  it('detects same-note self references as cyclic dependencies in authoring state', () => {
    renderRuntimeProviderChip({
      expressionSource: '[[draft_total]]',
      persistedStates: [],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'error:Cyclic dependency detected:Cyclic dependency detected',
    )
  })

  it('resolves the current note path as a same-note value dependency', () => {
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Current Note.draft_total]]',
      persistedStates: [],
      sidebarItems: [currentNote],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'error:Cyclic dependency detected:Cyclic dependency detected',
    )
  })

  it('does not resolve external values for notes missing from the filtered sidebar view', () => {
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')
    const hiddenNote = noteItem('note-2' as Id<'sidebarItems'>, 'Hidden Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Hidden Note.prof_bonus]] + 1',
      sidebarItems: [currentNote, hiddenNote],
      filteredSidebarItems: [currentNote],
      persistedStates: [],
      externalStates: [
        runtimeState({
          noteId: hiddenNote._id,
          valueId: 'hidden-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
      ],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'Unknown reference "prof_bonus"',
    )
    expect(useCampaignQueryMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ noteIds: [hiddenNote._id] }),
    )
  })

  it('reports duplicate authored slugs when the current note path is used', () => {
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Current Note.shared]]',
      persistedStates: [],
      sidebarItems: [currentNote],
      extraValues: [
        { valueId: 'value-2', slug: 'shared', expressionSource: '1' },
        { valueId: 'value-3', slug: 'shared', expressionSource: '2' },
      ],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'Slug "shared" is duplicated in this note',
    )
  })

  it('renders the slug and persisted formatted value', () => {
    renderInlineValue({ editable: false })

    expect(screen.getByTestId('note-value-inline')).toHaveTextContent('prof_bonus')
    expect(screen.getByTestId('note-value-inline')).toHaveTextContent('3')
  })

  it('shows an error icon instead of the inline error details', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      runtimeStates: [
        runtimeState({
          status: 'error',
          rawValue: null,
          formattedValue: '',
          errorCode: 'unknown_reference',
          errorMessage: 'Unknown reference: missing',
        }),
      ],
    })

    const chip = screen.getByTestId('note-value-inline')
    expect(chip).toHaveTextContent('prof_bonus')
    expect(chip).not.toHaveTextContent('Unknown reference: missing')
    expect(screen.getByLabelText('Value error')).toBeInTheDocument()

    await user.click(chip)

    expect(screen.getByTestId('note-value-preview')).toHaveTextContent('Unknown reference: missing')
  })

  it('shows a loading icon instead of no formula while an authored formula is pending', () => {
    renderInlineValue({
      runtimeStates: [],
    })

    const chip = screen.getByTestId('note-value-inline')
    expect(chip).toHaveTextContent('prof_bonus')
    expect(chip).not.toHaveTextContent('No formula')
    expect(screen.getByLabelText('Value loading')).toBeInTheDocument()
  })

  it('opens a popover editor from the chip and updates slug/formula props', async () => {
    const user = userEvent.setup()
    const updateInlineContent = vi.fn()
    renderInlineValue({ updateInlineContent })

    const chip = screen.getByTestId('note-value-inline')
    await user.click(chip)
    const slugInput = screen.getByRole('textbox', { name: 'Value slug' })

    expect(chip).toHaveAttribute('aria-haspopup', 'dialog')
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Edit value' })).toBeInTheDocument()
    expect(slugInput).toHaveFocus()

    fireEvent.change(slugInput, {
      target: { value: 'attack_bonus' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[prof_bonus]] + 1' },
    })

    expect(updateInlineContent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'value',
        props: expect.objectContaining({ slug: 'attack_bonus' }),
      }),
    )
    expect(updateInlineContent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'value',
        props: expect.objectContaining({ expressionSource: '[[prof_bonus]] + 1' }),
      }),
    )
    expect(screen.getByTestId('note-value-preview')).toHaveTextContent('3')
    expect(screen.getByText('Result')).toBeInTheDocument()
    expect(screen.queryByTestId('formula-feedback')).not.toBeInTheDocument()
  })

  it('closes the popover with Escape and restores focus to the chip', async () => {
    const user = userEvent.setup()
    renderInlineValue()

    const chip = screen.getByTestId('note-value-inline')
    await user.click(chip)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Edit value' })).not.toBeInTheDocument()
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(chip).toHaveFocus()
  })

  it('keeps raw slug input visible and shows debounced slug validation feedback', () => {
    vi.useFakeTimers()
    try {
      const updateInlineContent = vi.fn()
      renderInlineValue({ updateInlineContent })

      fireEvent.click(screen.getByTestId('note-value-inline'))
      fireEvent.change(screen.getByRole('textbox', { name: 'Value slug' }), {
        target: { value: 'attack-bonus' },
      })

      expect(screen.getByRole('textbox', { name: 'Value slug' })).toHaveValue('attack-bonus')
      expect(updateInlineContent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ slug: 'attack-bonus' }),
        }),
      )

      fireEvent.change(screen.getByRole('textbox', { name: 'Value slug' }), {
        target: { value: 'Attack Bonus' },
      })
      expect(screen.getByRole('textbox', { name: 'Value slug' })).toHaveValue('Attack Bonus')
      expect(
        screen.queryByText('Value slug cannot contain uppercase letters'),
      ).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(400)
      })

      expect(screen.getByText('Value slug cannot contain uppercase letters')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets left mouse down bubble so BlockNote can start drag interactions', () => {
    const bubbleListener = vi.fn()
    renderInlineValue()
    const chip = screen.getByTestId('note-value-inline')
    chip.parentElement?.addEventListener('mousedown', bubbleListener)

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })
    chip.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(bubbleListener).toHaveBeenCalledOnce()
    expect(chip).toHaveAttribute('draggable', 'true')
    expect(screen.queryByTestId('note-value-popover')).not.toBeInTheDocument()
  })

  it('focuses the chip on left mouse down without selecting its text', () => {
    renderInlineValue()
    const chip = screen.getByTestId('note-value-inline')
    window.getSelection()?.removeAllRanges()

    fireEvent.mouseDown(chip, { button: 0 })

    expect(document.activeElement).toBe(chip)
    expect(window.getSelection()?.toString()).toBe('')
    expect(window.getSelection()?.isCollapsed ?? true).toBe(true)
  })

  it('keeps the functions list behind a popover help button', async () => {
    const user = userEvent.setup()
    renderInlineValue()

    await user.click(screen.getByTestId('note-value-inline'))

    expect(screen.queryByText('Functions:')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Formula functions' }))

    expect(screen.getByRole('dialog', { name: 'Formula functions' })).toHaveTextContent(
      'min(value, ...values)',
    )
  })

  it('shows same-note value autocomplete suggestions with the slug and current value', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      authoredDefinitions: [
        {
          noteId: 'note-1' as Id<'sidebarItems'>,
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          rawValue: 18,
          formattedValue: '18',
        }),
      ],
    })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[' },
    })

    const suggestion = screen.getByRole('option', { name: /strength/ })
    expect(suggestion).toHaveTextContent('strength')
    expect(suggestion).toHaveTextContent('18')
  })

  it('allows selecting the current value and validates it as a cyclic dependency', async () => {
    vi.useFakeTimers()
    try {
      renderInlineValue({
        authoredDefinitions: [
          {
            noteId: 'note-1' as Id<'sidebarItems'>,
            blockNoteId: 'block-1',
            valueId: 'value-1',
            slug: 'prof_bonus',
            expressionSource: '3',
          },
        ],
        runtimeStates: (props) =>
          evaluateTestDefinitions([
            {
              noteId: 'note-1' as Id<'sidebarItems'>,
              blockNoteId: 'block-1',
              valueId: props.valueId,
              slug: props.slug,
              expressionSource: props.expressionSource,
            },
          ]),
      })

      fireEvent.click(screen.getByTestId('note-value-inline'))
      fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
        target: { value: '[[prof' },
      })

      fireEvent.mouseDown(screen.getByRole('option', { name: /prof_bonus/ }))
      await act(async () => {})
      act(() => {
        vi.advanceTimersByTime(400)
      })

      expect(screen.getByRole('textbox', { name: 'Value formula' })).toHaveValue('[[prof_bonus]]')
      expect(screen.getByTestId('note-value-preview')).toHaveTextContent(
        'Cyclic dependency detected',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows available external values on note autocomplete suggestions', async () => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')
    const sourceNote = noteItem('note-2' as Id<'sidebarItems'>, 'Source Note')
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteIds' in args && Array.isArray(args.noteIds)) {
        return {
          data: [
            runtimeState({
              noteId: sourceNote._id,
              blockNoteId: 'source-block-1',
              valueId: 'source-value-1',
              slug: 'prof_bonus',
              rawValue: 2,
              formattedValue: '2',
            }),
            runtimeState({
              noteId: sourceNote._id,
              blockNoteId: 'source-block-2',
              valueId: 'source-value-2',
              slug: 'save_dc',
              rawValue: 15,
              formattedValue: '15',
            }),
          ],
          status: 'success',
        }
      }
      return { data: [], status: 'success' }
    })

    renderInlineValue({ sidebarItems: [currentNote, sourceNote] })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[' },
    })

    expect(screen.getByRole('option', { name: /Current Note/ })).toBeInTheDocument()
    const noteSuggestion = screen.getByRole('option', { name: /Source Note/ })
    expect(noteSuggestion).toHaveTextContent('prof_bonus')
    expect(noteSuggestion).toHaveTextContent('2')
    expect(noteSuggestion).toHaveTextContent('save_dc')
    expect(noteSuggestion).toHaveTextContent('15')
  })

  it('shows authored values after selecting the current note in formula autocomplete', async () => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')
    renderInlineValue({
      sidebarItems: [currentNote],
      authoredDefinitions: [
        {
          noteId: 'note-1' as Id<'sidebarItems'>,
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          rawValue: 18,
          formattedValue: '18',
        }),
      ],
    })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[Current Note.' },
    })

    const suggestion = screen.getByRole('option', { name: /strength/ })
    expect(suggestion).toHaveTextContent('strength')
    expect(suggestion).toHaveTextContent('18')
  })

  it('scrolls the selected formula autocomplete option into view during keyboard navigation', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      renderInlineValue({
        authoredDefinitions: Array.from({ length: 6 }, (_, index) => ({
          noteId: 'note-1' as Id<'sidebarItems'>,
          blockNoteId: `block-${index + 2}`,
          valueId: `value-${index + 2}`,
          slug: `value_${index + 1}`,
          expressionSource: String(index + 1),
        })),
        runtimeStates: Array.from({ length: 7 }, (_, index) =>
          runtimeState({
            blockNoteId: `block-${index + 1}`,
            valueId: `value-${index + 1}`,
            slug: index === 0 ? 'prof_bonus' : `value_${index}`,
            rawValue: index,
            formattedValue: String(index),
          }),
        ),
      })

      await user.click(screen.getByTestId('note-value-inline'))
      fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
        target: { value: '[[' },
      })

      scrollIntoView.mockClear()
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Value formula' }), {
        key: 'ArrowDown',
      })

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }))
      const selectedOptions = screen
        .getAllByRole('option')
        .filter((option) => option.getAttribute('aria-selected') === 'true')
      expect(selectedOptions).toHaveLength(1)
      expect(selectedOptions[0]).toHaveTextContent('value_2')
    } finally {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })

  it('collapses excess note autocomplete values into a more pill', async () => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as Id<'sidebarItems'>, 'Current Note')
    const sourceNote = noteItem('note-2' as Id<'sidebarItems'>, 'Source Note')
    const measureElement = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getTestRect(this: HTMLElement) {
        if (this.hasAttribute('data-overflow-list-visible')) {
          return makeRect(220)
        }
        if (this.hasAttribute('data-overflow-list-item')) {
          return makeRect(50)
        }
        if (this.hasAttribute('data-overflow-list-overflow')) {
          return makeRect(60)
        }
        return makeRect(0)
      })
    useCampaignQueryMock.mockImplementation((_query, args) => {
      if (args && typeof args === 'object' && 'noteIds' in args && Array.isArray(args.noteIds)) {
        return {
          data: ['first', 'second', 'third', 'fourth', 'fifth'].map((slug, index) =>
            runtimeState({
              noteId: sourceNote._id,
              blockNoteId: `source-block-${index}`,
              valueId: `source-value-${index}`,
              slug,
              rawValue: index,
              formattedValue: String(index),
            }),
          ),
          status: 'success',
        }
      }
      return { data: [], status: 'success' }
    })

    try {
      renderInlineValue({ sidebarItems: [currentNote, sourceNote] })

      await user.click(screen.getByTestId('note-value-inline'))
      fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
        target: { value: '[[' },
      })

      const noteSuggestion = screen.getByRole('option', { name: /Source Note/ })
      const visibleValueList = noteSuggestion.querySelector('[data-overflow-list-visible]')
      await waitFor(() => expect(visibleValueList).toHaveTextContent('2 more'))

      expect(visibleValueList).toHaveTextContent('first')
      expect(visibleValueList).toHaveTextContent('second')
      expect(visibleValueList).toHaveTextContent('third')
      expect(visibleValueList).not.toHaveTextContent('fourth')
      expect(visibleValueList).not.toHaveTextContent('fifth')
    } finally {
      measureElement.mockRestore()
    }
  })

  it('shows formula dependencies using the same inline value chip display', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      authoredDefinitions: [
        {
          noteId: 'note-1' as Id<'sidebarItems'>,
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          blockNoteId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          rawValue: 18,
          formattedValue: '18',
        }),
      ],
    })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[strength]] + 2' },
    })

    const dependencies = screen.getByLabelText('Formula dependencies')
    const dependencyChip = dependencies.querySelector('[data-testid="note-value-inline"]')

    expect(dependencyChip).toHaveAttribute('data-note-value-slug', 'strength')
    expect(dependencyChip).not.toHaveAttribute('draggable', 'true')
    expect(dependencyChip).toHaveTextContent('strength')
    expect(dependencyChip).toHaveTextContent('18')
  })

  it('debounces formula validation feedback while typing', () => {
    vi.useFakeTimers()
    try {
      renderInlineValue({
        runtimeStates: (props) => [
          runtimeState(
            props.expressionSource.includes('missing')
              ? {
                  status: 'error',
                  rawValue: null,
                  formattedValue: '',
                  errorCode: 'unknown_reference',
                  errorMessage: 'Unknown reference: missing',
                }
              : {},
          ),
        ],
      })

      fireEvent.click(screen.getByTestId('note-value-inline'))
      fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
        target: { value: '[[missing]]' },
      })

      expect(screen.getByTestId('note-value-preview')).toHaveTextContent('Checking formula')
      expect(screen.getByRole('textbox', { name: 'Value formula' })).not.toHaveAttribute(
        'aria-invalid',
      )

      act(() => {
        vi.advanceTimersByTime(399)
      })
      expect(screen.getByTestId('note-value-preview')).not.toHaveTextContent('Unknown reference')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByTestId('note-value-preview')).toHaveTextContent(
        'Unknown reference: missing',
      )
      expect(screen.getByRole('textbox', { name: 'Value formula' })).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

function makeRect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height: 24,
    top: 0,
    right: width,
    bottom: 24,
    left: 0,
    toJSON: () => ({}),
  }
}
