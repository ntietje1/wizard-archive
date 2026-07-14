import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { use, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { canonicalizeResourceItemTitle } from '../../../workspace/items'
import type { AnyItem } from '../../../workspace/items'
import type { NoteItem } from '../../../notes/item-contract'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'

import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import type { NoteValueProps } from '../../values/schema'
import type { NoteValueAuthoringDefinition } from '../../values/runtime'
import type { NoteValueRuntimeState } from '../../values/state-contract'
import { evaluateNoteValueDefinitions } from '../../values/dependency-evaluator'
import { compileNoteValueDefinitions } from '../../values/runtime'
import { NoteValueRuntimeContext } from '../value-block-runtime-context'
import type { NoteValueRuntimeContextValue } from '../value-block-runtime-context'
import { NoteValueRuntimeProvider } from '../value-block-runtime'
import { ValueInlineContent } from '../value-block-spec'
import type { NoteValueReferences } from '../../value-runtime-model'

type TestRuntimeState = NoteValueRuntimeState<ResourceId>
type TestRuntimeOkState = Extract<TestRuntimeState, { status: 'ok' }>
type TestRuntimeErrorState = Extract<TestRuntimeState, { status: 'error' }>
type TestRuntimeStateOverrides =
  | Partial<TestRuntimeOkState>
  | (Pick<TestRuntimeErrorState, 'status' | 'errorCode' | 'errorMessage'> &
      Partial<Omit<TestRuntimeErrorState, 'status' | 'errorCode' | 'errorMessage'>>)

function runtimeState(overrides: TestRuntimeStateOverrides = {}): TestRuntimeState {
  const identity = {
    noteId: 'note-1' as ResourceId,
    noteBlockId: 'block-1',
    valueId: 'value-1',
    slug: 'prof_bonus',
  }
  if (overrides.status === 'error') {
    return { ...identity, ...overrides }
  }
  return {
    ...identity,
    status: 'ok',
    rawValue: 3,
    formattedValue: '3',
    ...overrides,
  }
}

function noteItem(id: ResourceId, name: string): NoteItem {
  return {
    id: id,
    createdAt: 1,
    name: canonicalizeResourceItemTitle(name),
    iconName: null,
    color: null,
    campaignId: 'campaign-1' as NoteItem['campaignId'],
    parentId: null,
    type: RESOURCE_TYPES.notes,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-1' as NoteItem['createdBy'],
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
  }
}

function createReferences(items: Array<AnyItem>): NoteValueReferences {
  const itemsByName = new Map(items.map((item) => [String(item.name), item] as const))

  return {
    getNoteCandidates: () =>
      items.map((item) => ({
        noteId: item.id,
        title: item.name,
        path: item.name,
      })),
    resolveNoteIdByPath: ({ notePathRaw }) =>
      notePathRaw ? (itemsByName.get(notePathRaw)?.id ?? null) : null,
  }
}

function renderInlineValue({
  editable = true,
  updateInlineContent = vi.fn(),
  authoredDefinitions = [],
  runtimeStates = [runtimeState()],
  sidebarItems = [],
  valueStatesForNotes = [],
  externalDependencyStatesStatus = 'success',
}: {
  editable?: boolean
  authoredDefinitions?: Array<NoteValueAuthoringDefinition<ResourceId>>
  updateInlineContent?: (update: {
    type: 'value'
    props: { valueId: string; slug: string; expressionSource: string }
  }) => void
  runtimeStates?:
    | Array<NoteValueRuntimeState<ResourceId>>
    | ((props: NoteValueProps) => Array<NoteValueRuntimeState<ResourceId>>)
  sidebarItems?: Array<AnyItem>
  valueStatesForNotes?: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStatesStatus?: 'pending' | 'success' | 'error'
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
          noteId: 'note-1' as ResourceId,
          editable,
          authoredDefinitions,
          authoredValueStates: currentRuntimeStates,
          externalDependencyStates: valueStatesForNotes,
          externalDependencyStatesStatus,
          referenceableStates: valueStatesForNotes,
          referenceableStatesStatus: 'success',
          stateByValueId: new Map(currentRuntimeStates.map((state) => [state.valueId, state])),
          references: createReferences(sidebarItems),
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
  externalDependencyStates = [],
  externalDependencyStatesStatus = 'success',
  referenceableStates = externalDependencyStates,
  sidebarItems = [],
  filteredSidebarItems = sidebarItems,
  extraValues = [],
}: {
  expressionSource: string
  evaluateValuesFromEditor?: boolean
  persistedStates: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStates?: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStatesStatus?: 'pending' | 'success' | 'error'
  referenceableStates?: Array<NoteValueRuntimeState<ResourceId>>
  sidebarItems?: Array<AnyItem>
  filteredSidebarItems?: Array<AnyItem>
  extraValues?: Parameters<typeof makeRuntimeProviderEditor>[1]
}) {
  const authoredDefinitions: Array<NoteValueAuthoringDefinition<ResourceId>> = [
    {
      noteId: 'note-1' as ResourceId,
      noteBlockId: 'block-1',
      valueId: 'value-1',
      slug: 'draft_total',
      expressionSource,
    },
    ...extraValues.map((value, index) => ({
      noteId: 'note-1' as ResourceId,
      noteBlockId: `block-${index + 2}`,
      valueId: value.valueId,
      slug: value.slug,
      expressionSource: value.expressionSource,
    })),
  ]
  function RuntimeStateChip() {
    const { stateByValueId } = useNoteValueRuntimeForTest()
    const state = stateByValueId.get('value-1')
    return (
      <div data-testid="provider-value-state">
        {state?.status}:{state?.status === 'ok' ? state.formattedValue : ''}:
        {state?.status === 'error' ? state.errorMessage : ''}
      </div>
    )
  }

  render(
    <NoteValueRuntimeProvider
      editor={makeRuntimeProviderEditor(expressionSource, extraValues)}
      editable={false}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
      source={{
        noteId: 'note-1' as ResourceId,
        authoredDefinitions,
        externalDependencyStates,
        externalDependencyStatesStatus,
        persistedStates,
        referenceableStates,
        referenceableStatesStatus: 'success',
        references: createReferences(filteredSidebarItems),
      }}
    >
      <RuntimeStateChip />
    </NoteValueRuntimeProvider>,
  )
}

function useNoteValueRuntimeForTest() {
  return use(NoteValueRuntimeContext)!
}

function evaluateTestDefinitions(definitions: Array<NoteValueAuthoringDefinition<ResourceId>>) {
  const compiledDefinitions = compileNoteValueDefinitions(definitions, {
    currentNoteId: 'note-1' as ResourceId,
    resolveExternal: () => ({
      ok: false,
      errorCode: 'unknown_reference',
      errorMessage: 'External references are not available in this test',
    }),
  })
  return evaluateNoteValueDefinitions(compiledDefinitions, () => null)
}

describe('inline value chip runtime', () => {
  it('evaluates authored values from a supplied runtime source', () => {
    function RuntimeStateChip() {
      const { stateByValueId } = useNoteValueRuntimeForTest()
      const state = stateByValueId.get('value-1')
      return (
        <div data-testid="provider-value-state">
          {state?.status}:{state?.status === 'ok' ? state.formattedValue : ''}:
          {state?.status === 'error' ? state.errorMessage : ''}
        </div>
      )
    }

    render(
      <NoteValueRuntimeProvider
        editor={makeRuntimeProviderEditor('100')}
        editable={false}
        evaluateValuesFromEditor
        source={{
          noteId: 'note-1' as ResourceId,
          authoredDefinitions: [
            {
              noteId: 'note-1' as ResourceId,
              noteBlockId: 'block-1',
              valueId: 'value-1',
              slug: 'draft_total',
              expressionSource: '2 + 1',
            },
          ],
          externalDependencyStates: [],
          externalDependencyStatesStatus: 'success',
          persistedStates: [
            runtimeState({
              valueId: 'value-1',
              slug: 'draft_total',
              rawValue: 100,
              formattedValue: '100',
            }),
          ],
          referenceableStates: [],
          referenceableStatesStatus: 'success',
          references: createReferences([]),
        }}
      >
        <RuntimeStateChip />
      </NoteValueRuntimeProvider>,
    )

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent('ok:3:')
  })

  it('keeps the runtime context stable when the source inputs do not change', () => {
    const contextValues: Array<NoteValueRuntimeContextValue> = []
    const source = {
      noteId: 'note-1' as ResourceId,
      authoredDefinitions: [
        {
          noteId: 'note-1' as ResourceId,
          noteBlockId: 'block-1',
          valueId: 'value-1',
          slug: 'draft_total',
          expressionSource: '2 + 1',
        },
      ],
      externalDependencyStates: [],
      externalDependencyStatesStatus: 'success' as const,
      persistedStates: [],
      referenceableStates: [],
      referenceableStatesStatus: 'success' as const,
      references: createReferences([]),
    }

    function RuntimeStateCapture() {
      contextValues.push(useNoteValueRuntimeForTest())
      return null
    }

    function RuntimeProviderHost() {
      const [renderCount, setRenderCount] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
            rerender {renderCount}
          </button>
          <NoteValueRuntimeProvider
            editor={makeRuntimeProviderEditor('2 + 1')}
            editable={false}
            evaluateValuesFromEditor
            source={source}
          >
            <RuntimeStateCapture />
          </NoteValueRuntimeProvider>
        </>
      )
    }

    render(<RuntimeProviderHost />)
    fireEvent.click(screen.getByRole('button', { name: /rerender/ }))

    expect(contextValues).toHaveLength(2)
    expect(contextValues[1]).toBe(contextValues[0])
  })

  it('evaluates changed external-reference drafts from authoring state', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')

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
      externalDependencyStates: [
        runtimeState({
          noteId: sourceNote.id,
          valueId: 'source-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
      ],
      externalDependencyStatesStatus: 'success' as const,
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent('ok:3:')
  })

  it('keeps external formulas pending while dependency states load', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Source Note.prof_bonus]] + 1',
      sidebarItems: [currentNote, sourceNote],
      persistedStates: [],
      externalDependencyStatesStatus: 'pending',
    })

    expect(screen.getByTestId('provider-value-state')).not.toHaveTextContent('Unknown reference')
    expect(screen.getByTestId('provider-value-state')).toHaveTextContent('::')
  })

  it('reports failed external dependency loads instead of unknown references', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Source Note.prof_bonus]] + 1',
      sidebarItems: [currentNote, sourceNote],
      persistedStates: [],
      externalDependencyStatesStatus: 'error',
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'Failed to load external reference "[[Source Note.prof_bonus]]"',
    )
    expect(screen.getByTestId('provider-value-state')).not.toHaveTextContent('Unknown reference')
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
      'error::Cyclic dependency detected',
    )
  })

  it('resolves the current note path as a same-note value dependency', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Current Note.draft_total]]',
      persistedStates: [],
      sidebarItems: [currentNote],
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'error::Cyclic dependency detected',
    )
  })

  it('reports filtered external notes as unknown references', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const hiddenNote = noteItem('note-2' as ResourceId, 'Hidden Note')

    renderRuntimeProviderChip({
      expressionSource: '[[Hidden Note.prof_bonus]] + 1',
      sidebarItems: [currentNote, hiddenNote],
      filteredSidebarItems: [currentNote],
      persistedStates: [],
      externalDependencyStates: [
        runtimeState({
          noteId: hiddenNote.id,
          valueId: 'hidden-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
      ],
      externalDependencyStatesStatus: 'success' as const,
    })

    expect(screen.getByTestId('provider-value-state')).toHaveTextContent(
      'Unknown reference "[[Hidden Note.prof_bonus]]"',
    )
  })

  it('reports duplicate authored slugs when the current note path is used', () => {
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')

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

  it('shows error details from the chip popover', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      runtimeStates: [
        runtimeState({
          status: 'error',
          errorCode: 'unknown_reference',
          errorMessage: 'Unknown reference: missing',
        }),
      ],
    })

    const chip = screen.getByTestId('note-value-inline')
    expect(chip).toHaveTextContent('prof_bonus')
    expect(screen.getByLabelText('Value error')).toBeInTheDocument()

    await user.click(chip)

    expect(screen.getByTestId('note-value-preview')).toHaveTextContent('Unknown reference: missing')
  })

  it('shows a loading icon while an authored formula is pending', () => {
    renderInlineValue({
      runtimeStates: [],
    })

    const chip = screen.getByTestId('note-value-inline')
    expect(chip).toHaveTextContent('prof_bonus')
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
  })

  it('closes the popover with Escape and restores focus to the chip', async () => {
    const user = userEvent.setup()
    renderInlineValue()

    const chip = screen.getByTestId('note-value-inline')
    await user.click(chip)

    fireEvent.keyDown(document, { key: 'Escape' })

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

    expect(bubbleListener).toHaveBeenCalledOnce()
    expect(chip).toHaveAttribute('draggable', 'true')
  })

  it('focuses the chip on left mouse down and keeps selection collapsed', () => {
    renderInlineValue()
    const chip = screen.getByTestId('note-value-inline')
    window.getSelection()?.removeAllRanges()

    fireEvent.mouseDown(chip, { button: 0 })

    expect(document.activeElement).toBe(chip)
    expect(window.getSelection()?.isCollapsed ?? true).toBe(true)
  })

  it('keeps the functions list behind a popover help button', async () => {
    const user = userEvent.setup()
    renderInlineValue()

    await user.click(screen.getByTestId('note-value-inline'))

    await user.click(screen.getByRole('button', { name: 'Formula functions' }))

    expect(screen.getByRole('region', { name: 'Formula functions' })).toHaveTextContent(
      'min(value, ...values)',
    )
  })

  it('shows same-note value autocomplete suggestions with the slug and current value', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      authoredDefinitions: [
        {
          noteId: 'note-1' as ResourceId,
          noteBlockId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          noteBlockId: 'block-2',
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
            noteId: 'note-1' as ResourceId,
            noteBlockId: 'block-1',
            valueId: 'value-1',
            slug: 'prof_bonus',
            expressionSource: '3',
          },
        ],
        runtimeStates: (props) =>
          evaluateTestDefinitions([
            {
              noteId: 'note-1' as ResourceId,
              noteBlockId: 'block-1',
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
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')

    renderInlineValue({
      sidebarItems: [currentNote, sourceNote],
      valueStatesForNotes: [
        runtimeState({
          noteId: sourceNote.id,
          noteBlockId: 'source-block-1',
          valueId: 'source-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
        runtimeState({
          noteId: sourceNote.id,
          noteBlockId: 'source-block-2',
          valueId: 'source-value-2',
          slug: 'save_dc',
          rawValue: 15,
          formattedValue: '15',
        }),
      ],
    })

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
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    renderInlineValue({
      sidebarItems: [currentNote],
      authoredDefinitions: [
        {
          noteId: 'note-1' as ResourceId,
          noteBlockId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          noteBlockId: 'block-2',
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
          noteId: 'note-1' as ResourceId,
          noteBlockId: `block-${index + 2}`,
          valueId: `value-${index + 2}`,
          slug: `value_${index + 1}`,
          expressionSource: String(index + 1),
        })),
        runtimeStates: Array.from({ length: 7 }, (_, index) =>
          runtimeState({
            noteBlockId: `block-${index + 1}`,
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
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')
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
    try {
      renderInlineValue({
        sidebarItems: [currentNote, sourceNote],
        valueStatesForNotes: ['first', 'second', 'third', 'fourth', 'fifth'].map((slug, index) =>
          runtimeState({
            noteId: sourceNote.id,
            noteBlockId: `source-block-${index}`,
            valueId: `source-value-${index}`,
            slug,
            rawValue: index,
            formattedValue: String(index),
          }),
        ),
      })

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
    } finally {
      measureElement.mockRestore()
    }
  })

  it('shows formula dependencies using the same inline value chip display', async () => {
    const user = userEvent.setup()
    renderInlineValue({
      authoredDefinitions: [
        {
          noteId: 'note-1' as ResourceId,
          noteBlockId: 'block-2',
          valueId: 'value-2',
          slug: 'strength',
          expressionSource: '18',
        },
      ],
      runtimeStates: [
        runtimeState(),
        runtimeState({
          noteBlockId: 'block-2',
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
    expect(dependencyChip).toHaveTextContent('strength')
    expect(dependencyChip).toHaveTextContent('18')
  })

  it('shows external formula dependencies resolved through workspace note paths', async () => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')
    renderInlineValue({
      sidebarItems: [currentNote, sourceNote],
      valueStatesForNotes: [
        runtimeState({
          noteId: sourceNote.id,
          noteBlockId: 'source-block-1',
          valueId: 'source-value-1',
          slug: 'prof_bonus',
          rawValue: 2,
          formattedValue: '2',
        }),
      ],
    })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[Source Note.prof_bonus]] + 2' },
    })

    const dependencies = screen.getByLabelText('Formula dependencies')
    const dependencyChip = dependencies.querySelector('[data-testid="note-value-inline"]')

    expect(dependencyChip).toHaveAttribute('data-note-value-slug', 'prof_bonus')
    expect(dependencyChip).toHaveTextContent('prof_bonus')
    expect(dependencyChip).toHaveTextContent('2')
  })

  it('shows an error dependency for an unresolved external note path', async () => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    renderInlineValue({ sidebarItems: [currentNote], valueStatesForNotes: [] })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[Missing Note.prof_bonus]] + 2' },
    })

    const dependency = screen
      .getByLabelText('Formula dependencies')
      .querySelector('[data-testid="note-value-inline"]')
    expect(dependency).toHaveAttribute('data-note-value-state', 'error')
    expect(dependency).toHaveAttribute('title', 'Unknown reference "[[Missing Note.prof_bonus]]"')
  })

  it.each([
    ['pending', 'Loading value'],
    ['error', 'Failed to load value'],
  ] as const)('shows %s external formula dependency state', async (status, message) => {
    const user = userEvent.setup()
    const currentNote = noteItem('note-1' as ResourceId, 'Current Note')
    const sourceNote = noteItem('note-2' as ResourceId, 'Source Note')
    renderInlineValue({
      externalDependencyStatesStatus: status,
      sidebarItems: [currentNote, sourceNote],
      valueStatesForNotes: [],
    })

    await user.click(screen.getByTestId('note-value-inline'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value formula' }), {
      target: { value: '[[Source Note.prof_bonus]] + 2' },
    })

    const dependency = screen
      .getByLabelText('Formula dependencies')
      .querySelector('[data-testid="note-value-inline"]')
    if (status === 'pending') {
      expect(dependency).toHaveTextContent(message)
    } else {
      expect(dependency).toHaveAttribute('data-note-value-state', 'error')
      expect(dependency).toHaveAttribute('title', message)
    }
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

      act(() => {
        vi.advanceTimersByTime(399)
      })

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
