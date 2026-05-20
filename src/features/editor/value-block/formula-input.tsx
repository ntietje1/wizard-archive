import { useEffect, useRef, useState } from 'react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { Dispatch, KeyboardEvent, Ref, SetStateAction } from 'react'
import {
  applyFormulaAutocompleteInsertion,
  getFormulaAutocompleteContext,
} from '../../../../shared/note-values/authoring'
import type { FormulaAutocompleteContext } from '../../../../shared/note-values/authoring'
import { collectFormulaReferences } from '../../../../shared/note-values/formula'
import type { NoteValueRuntimeState } from '../../../../shared/note-values/types'
import { getFormulaSuggestions } from './formula-suggestions'
import type { FormulaSuggestion } from './formula-suggestions'
import { useNoteValueRuntime } from './value-block-runtime-context'
import { resolveExternalNoteId, useValueReferenceAuthoring } from './use-value-reference-authoring'
import { ValueInlineChip } from './value-inline-chip'
import { Input } from '~/features/shadcn/components/input'
import { OverflowList } from '~/shared/components/overflow-list'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useScrollSelectedItemIntoView } from '~/shared/hooks/use-scroll-selected-item-into-view'
import { cn } from '~/features/shadcn/lib/utils'

interface FormulaDependency {
  key: string
  slug: string
  valueId: string
  state: NoteValueRuntimeState<Id<'sidebarItems'>> | undefined
}

interface FormulaDependenciesResult {
  visible: Array<FormulaDependency>
  total: number
  hasMore: boolean
}

const MAX_VISIBLE_FORMULA_DEPENDENCIES = 6

function getExternalValueKey(noteId: Id<'sidebarItems'>, slug: string) {
  return `${noteId}:${slug}`
}

function getLocalValueBySlug(localValues: Array<{ valueId: string; slug: string }>) {
  const valuesBySlug = new Map<string, { valueId: string; slug: string }>()
  for (const value of localValues) {
    valuesBySlug.set(value.slug, value)
  }
  return valuesBySlug
}

function getExternalStateByKey(externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>) {
  const statesByKey = new Map<string, NoteValueRuntimeState<Id<'sidebarItems'>>>()
  for (const state of externalStates) {
    statesByKey.set(getExternalValueKey(state.noteId, state.slug), state)
  }
  return statesByKey
}

function getReferencedDependencies(
  expressionSource: string,
  localValues: Array<{ valueId: string; slug: string }>,
  stateByValueId: Map<string, NoteValueRuntimeState<Id<'sidebarItems'>>>,
  externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>,
  externalNoteIdByPath: Map<string, Id<'sidebarItems'>>,
): FormulaDependenciesResult {
  const dependencies: Array<FormulaDependency> = []
  const seen = new Set<string>()
  const references = collectFormulaReferences(expressionSource)
  const localValueBySlug = getLocalValueBySlug(localValues)
  const externalStateByKey = getExternalStateByKey(externalStates)

  for (const reference of references) {
    if (reference.kind === 'self') {
      const localValue = localValueBySlug.get(reference.slug)
      if (!localValue || seen.has(localValue.valueId)) continue
      seen.add(localValue.valueId)
      dependencies.push({
        key: localValue.valueId,
        slug: localValue.slug,
        valueId: localValue.valueId,
        state: stateByValueId.get(localValue.valueId),
      })
      continue
    }

    const externalNoteId = externalNoteIdByPath.get(reference.notePathRaw)
    const externalState = externalNoteId
      ? externalStateByKey.get(getExternalValueKey(externalNoteId, reference.slug))
      : undefined
    const externalValueKey = externalState
      ? `${externalState.noteId}:${externalState.valueId}`
      : null
    if (!externalState || !externalValueKey || seen.has(externalValueKey)) continue
    seen.add(externalValueKey)
    dependencies.push({
      key: externalValueKey,
      slug: externalState.slug,
      valueId: externalState.valueId,
      state: externalState,
    })
  }

  return {
    visible: dependencies.slice(0, MAX_VISIBLE_FORMULA_DEPENDENCIES),
    total: dependencies.length,
    hasMore: dependencies.length > MAX_VISIBLE_FORMULA_DEPENDENCIES,
  }
}

function getDisplayedValue(state: NoteValueRuntimeState<Id<'sidebarItems'>> | undefined) {
  return state?.status === 'ok' ? state.formattedValue : (state?.errorMessage ?? 'No formula')
}

function getHasError(state: NoteValueRuntimeState<Id<'sidebarItems'>> | undefined) {
  return state?.status === 'error'
}

function SuggestionValueChip({ value }: { value: NoteValueRuntimeState<Id<'sidebarItems'>> }) {
  return (
    <ValueInlineChip
      slug={value.slug}
      displayedValue={getDisplayedValue(value)}
      hasError={getHasError(value)}
      valueId={value.valueId}
      state={value.status}
      className="max-w-28 bg-background"
    />
  )
}

function OverflowValueCountPill({ hiddenValueCount }: { hiddenValueCount: number }) {
  return (
    <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {hiddenValueCount} more&hellip;
    </span>
  )
}

function SuggestionValueChips({
  values,
}: {
  values: NonNullable<FormulaSuggestion['previewValues']>
}) {
  if (values.length === 0) {
    return null
  }

  return (
    <OverflowList
      items={values.map((value) => ({
        key: value.valueId,
        content: <SuggestionValueChip value={value} />,
      }))}
      getOverflowItem={(hiddenValueCount) => (
        <OverflowValueCountPill hiddenValueCount={hiddenValueCount} />
      )}
      className="gap-1 pt-0.5"
      itemClassName="inline-flex shrink-0"
    />
  )
}

function getExternalNoteIdByPath({
  expressionSource,
  sidebarItems,
  itemsMap,
  sourceParentId,
}: {
  expressionSource: string
  sidebarItems: ReturnType<typeof useNoteValueRuntime>['sidebarItems']
  itemsMap: ReturnType<typeof useNoteValueRuntime>['itemsMap']
  sourceParentId: Id<'sidebarItems'> | null | undefined
}) {
  const noteIdByPath = new Map<string, Id<'sidebarItems'>>()
  for (const reference of collectFormulaReferences(expressionSource)) {
    if (reference.kind !== 'external') continue
    const externalNoteId = resolveExternalNoteId(
      reference.notePathRaw,
      sidebarItems,
      itemsMap,
      sourceParentId,
    )
    if (externalNoteId) {
      noteIdByPath.set(reference.notePathRaw, externalNoteId)
    }
  }
  return noteIdByPath
}

function useFormulaDependencies({
  expressionSource,
  authoredDefinitions,
  itemsMap,
  noteId,
  sidebarItems,
  stateByValueId,
}: {
  expressionSource: string
  authoredDefinitions: ReturnType<typeof useNoteValueRuntime>['authoredDefinitions']
  itemsMap: ReturnType<typeof useNoteValueRuntime>['itemsMap']
  noteId: ReturnType<typeof useNoteValueRuntime>['noteId']
  sidebarItems: ReturnType<typeof useNoteValueRuntime>['sidebarItems']
  stateByValueId: ReturnType<typeof useNoteValueRuntime>['stateByValueId']
}) {
  const sourceParentId = noteId ? itemsMap.get(noteId)?.parentId : undefined
  const externalNoteIdByPath = getExternalNoteIdByPath({
    expressionSource,
    sidebarItems,
    itemsMap,
    sourceParentId,
  })
  const externalNoteIds = [...new Set(externalNoteIdByPath.values())]
  const externalStatesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    externalNoteIds.length > 0 ? { noteIds: externalNoteIds } : 'skip',
  )

  return getReferencedDependencies(
    expressionSource,
    authoredDefinitions,
    stateByValueId,
    externalStatesQuery.data ?? [],
    externalNoteIdByPath,
  )
}

function FormulaSuggestionsList({
  context,
  suggestions,
  selectedIndex,
  externalValuesPending,
  applySuggestion,
}: {
  context: FormulaAutocompleteContext
  suggestions: Array<FormulaSuggestion>
  selectedIndex: number
  externalValuesPending: boolean
  applySuggestion: (suggestion: FormulaSuggestion) => void
}) {
  const selectedItemRef = useScrollSelectedItemIntoView<HTMLButtonElement>(
    suggestions[Math.min(selectedIndex, suggestions.length - 1)]?.key ?? selectedIndex,
  )

  return (
    <div
      role="listbox"
      aria-label="Formula suggestions"
      className="absolute top-10 left-0 z-60 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
      data-testid="formula-autocomplete"
    >
      {suggestions.length > 0 ? (
        suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.kind}-${suggestion.key}`}
            ref={index === selectedIndex ? selectedItemRef : undefined}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              'flex w-full items-start justify-between gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted',
              index === selectedIndex && 'bg-muted',
            )}
            onMouseDown={(event) => {
              event.preventDefault()
              applySuggestion(suggestion)
            }}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate">{suggestion.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {suggestion.detail}
              </span>
              {suggestion.previewValues ? (
                <SuggestionValueChips values={suggestion.previewValues} />
              ) : null}
            </div>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              {suggestion.kind === 'external_value' ? 'value' : suggestion.kind}
            </span>
          </button>
        ))
      ) : (
        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
          {context.kind === 'external_value' && externalValuesPending ? (
            <>Loading values&hellip;</>
          ) : (
            'No suggestions'
          )}
        </div>
      )}
    </div>
  )
}

function FormulaDependencyChips({ dependencies }: { dependencies: FormulaDependenciesResult }) {
  if (dependencies.total === 0) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1" aria-label="Formula dependencies">
      {dependencies.visible.map((dependency) => (
        <ValueInlineChip
          key={dependency.key}
          slug={dependency.slug}
          displayedValue={getDisplayedValue(dependency.state)}
          hasError={getHasError(dependency.state)}
          valueId={dependency.valueId}
          state={dependency.state?.status ?? 'pending'}
        />
      ))}
      {dependencies.hasMore ? (
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          +{dependencies.total - dependencies.visible.length} more
        </span>
      ) : null}
    </div>
  )
}

function handleAutocompleteKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  {
    activeSuggestion,
    applySuggestion,
    context,
    openAutocomplete,
    setContext,
    setSelectedIndex,
    suggestions,
    value,
  }: {
    activeSuggestion: FormulaSuggestion | undefined
    applySuggestion: (suggestion: FormulaSuggestion) => void
    context: FormulaAutocompleteContext | null
    openAutocomplete: (
      expression: string,
      cursorPosition: number,
      force?: boolean,
      selectionEnd?: number | null,
    ) => void
    setContext: (context: FormulaAutocompleteContext | null) => void
    setSelectedIndex: Dispatch<SetStateAction<number>>
    suggestions: Array<FormulaSuggestion>
    value: string
  },
) {
  if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
    event.preventDefault()
    openAutocomplete(
      value,
      event.currentTarget.selectionStart ?? value.length,
      true,
      event.currentTarget.selectionEnd,
    )
    return
  }
  if (!context) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    setContext(null)
    return
  }
  if (suggestions.length === 0) {
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setSelectedIndex((index) => (index + 1) % suggestions.length)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    if (activeSuggestion) {
      applySuggestion(activeSuggestion)
    }
  }
}

export function FormulaInput({
  id,
  value,
  showValidationError,
  placeholder,
  onChange,
  onBlur,
  ref: forwardedRef,
}: {
  id: string
  value: string
  showValidationError: boolean
  placeholder?: string
  onChange: (value: string) => void
  onBlur?: () => void
  ref?: Ref<HTMLInputElement>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeAutocompleteTimeoutRef = useRef<number | null>(null)
  const { authoredDefinitions, itemsMap, noteId, sidebarItems, stateByValueId } =
    useNoteValueRuntime()
  const [context, setContext] = useState<FormulaAutocompleteContext | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const referenceAuthoring = useValueReferenceAuthoring({
    externalNotePathRaw: context?.kind === 'external_value' ? context.notePathRaw : null,
    includeNoteValuePreviews: context?.kind === 'external_note',
  })

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const clearCloseAutocompleteTimeout = () => {
    if (closeAutocompleteTimeoutRef.current === null) return
    window.clearTimeout(closeAutocompleteTimeoutRef.current)
    closeAutocompleteTimeoutRef.current = null
  }

  useEffect(
    () => () => {
      if (closeAutocompleteTimeoutRef.current === null) return
      window.clearTimeout(closeAutocompleteTimeoutRef.current)
      closeAutocompleteTimeoutRef.current = null
    },
    [],
  )

  const openAutocomplete = (
    expression: string,
    cursorPosition: number,
    force = false,
    selectionEnd?: number | null,
  ) => {
    clearCloseAutocompleteTimeout()
    const nextContext = getFormulaAutocompleteContext(expression, cursorPosition, {
      force,
      selectionEnd,
    })
    setContext(nextContext)
    setSelectedIndex(0)
  }

  const suggestions = getFormulaSuggestions({
    context,
    sameNoteCandidates: referenceAuthoring.sameNoteCandidates,
    noteCandidates: referenceAuthoring.noteCandidates,
    externalValueCandidates: referenceAuthoring.externalValueCandidates,
  })

  const dependencies = useFormulaDependencies({
    expressionSource: value,
    authoredDefinitions,
    itemsMap,
    noteId,
    sidebarItems,
    stateByValueId,
  })

  const applySuggestion = (suggestion: FormulaSuggestion) => {
    if (!context) return
    const inserted = applyFormulaAutocompleteInsertion(value, context, suggestion.insertText)
    onChange(inserted.expressionSource)
    const shouldStayOpen = suggestion.kind === 'note'
    clearCloseAutocompleteTimeout()
    queueMicrotask(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(inserted.cursorPosition, inserted.cursorPosition)
      if (shouldStayOpen) {
        openAutocomplete(inserted.expressionSource, inserted.cursorPosition, true)
      } else {
        setContext(null)
      }
    })
  }

  const activeSuggestion = suggestions[Math.min(selectedIndex, suggestions.length - 1)]

  return (
    <div className="relative grid min-w-0 gap-1.5">
      <Input
        id={id}
        aria-label="Value formula"
        aria-invalid={showValidationError || undefined}
        ref={setInputRef}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          onChange(nextValue)
          openAutocomplete(nextValue, event.target.selectionStart ?? nextValue.length)
        }}
        onFocus={(event) => {
          openAutocomplete(
            event.currentTarget.value,
            event.currentTarget.selectionStart ?? value.length,
          )
        }}
        onKeyDown={(event) =>
          handleAutocompleteKeyDown(event, {
            activeSuggestion,
            applySuggestion,
            context,
            openAutocomplete,
            setContext,
            setSelectedIndex,
            suggestions,
            value,
          })
        }
        onBlur={() => {
          clearCloseAutocompleteTimeout()
          closeAutocompleteTimeoutRef.current = window.setTimeout(() => {
            closeAutocompleteTimeoutRef.current = null
            setContext(null)
          }, 100)
          onBlur?.()
        }}
        placeholder={placeholder}
        className={cn(
          'font-mono',
          showValidationError && 'border-destructive focus-visible:ring-destructive/30',
        )}
      />

      {context ? (
        <FormulaSuggestionsList
          context={context}
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          externalValuesPending={referenceAuthoring.externalValuesStatus === 'pending'}
          applySuggestion={applySuggestion}
        />
      ) : null}

      <FormulaDependencyChips dependencies={dependencies} />
    </div>
  )
}
