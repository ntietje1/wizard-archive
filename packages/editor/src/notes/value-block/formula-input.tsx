import { useEffect, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, Ref, SetStateAction } from 'react'
import {
  applyFormulaAutocompleteInsertion,
  getFormulaAutocompleteContext,
} from '../values/authoring'
import type { FormulaAutocompleteContext } from '../values/authoring'
import { collectFormulaReferences } from '../values/formula-parser'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { FormulaReferenceToken } from '../values/model'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { getFormulaSuggestions } from './formula-suggestions'
import type { FormulaSuggestion } from './formula-suggestions'
import { useNoteValueRuntime } from './value-block-runtime-context'
import { useValueReferenceAuthoring } from './use-value-reference-authoring'
import { ValueInlineChip } from './value-inline-chip'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { OverflowList } from '@wizard-archive/ui/components/overflow-list'
import { useScrollSelectedItemIntoView } from '@wizard-archive/ui/hooks/use-scroll-selected-item-into-view'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface FormulaDependency {
  key: string
  slug: string
  valueId: string
  displayedValue: string
  hasError: boolean
  state: 'ok' | 'error' | 'pending'
}

interface FormulaDependenciesResult {
  visible: Array<FormulaDependency>
  total: number
  hasMore: boolean
}

const MAX_VISIBLE_FORMULA_DEPENDENCIES = 6

function getExternalValueKey(noteId: SidebarItemId, slug: string) {
  return `${noteId}:${slug}`
}

function getLocalValuesBySlug(localValues: Array<{ valueId: string; slug: string }>) {
  const valuesBySlug = new Map<string, Array<{ valueId: string; slug: string }>>()
  for (const value of localValues) {
    const values = valuesBySlug.get(value.slug)
    if (values) values.push(value)
    else valuesBySlug.set(value.slug, [value])
  }
  return valuesBySlug
}

function getReferenceableStatesByKey(
  referenceableStates: Array<NoteValueRuntimeState<SidebarItemId>>,
) {
  const statesByKey = new Map<string, Array<NoteValueRuntimeState<SidebarItemId>>>()
  for (const state of referenceableStates) {
    const key = getExternalValueKey(state.noteId, state.slug)
    const states = statesByKey.get(key)
    if (states) states.push(state)
    else statesByKey.set(key, [state])
  }
  return statesByKey
}

function duplicateExternalSlugDependency({
  noteId,
  slug,
}: {
  noteId: SidebarItemId
  slug: string
}): FormulaDependency {
  return {
    key: `${noteId}:${slug}:duplicate`,
    slug,
    valueId: `${noteId}:${slug}:duplicate`,
    displayedValue: `Slug "${slug}" is duplicated in the target note`,
    hasError: true,
    state: 'error',
  }
}

function duplicateLocalSlugDependency(slug: string): FormulaDependency {
  return {
    key: `local:${slug}:duplicate`,
    slug,
    valueId: `local:${slug}:duplicate`,
    displayedValue: `Slug "${slug}" is duplicated in this note`,
    hasError: true,
    state: 'error',
  }
}

function unresolvedExternalDependency({
  notePathRaw,
  slug,
}: {
  notePathRaw: string
  slug: string
}): FormulaDependency {
  const reference = `[[${notePathRaw}.${slug}]]`
  return {
    key: `unresolved:${notePathRaw}:${slug}`,
    slug,
    valueId: `unresolved:${notePathRaw}:${slug}`,
    displayedValue: `Unknown reference "${reference}"`,
    hasError: true,
    state: 'error',
  }
}

function addDependency(
  dependencies: Array<FormulaDependency>,
  seen: Set<string>,
  dependency: FormulaDependency | null,
) {
  if (!dependency || seen.has(dependency.key)) return
  seen.add(dependency.key)
  dependencies.push(dependency)
}

function getLocalDependency(
  matchingValues: Array<{ valueId: string; slug: string }> | undefined,
  stateByValueId: Map<string, NoteValueRuntimeState<SidebarItemId>>,
): FormulaDependency | null {
  if (matchingValues && matchingValues.length > 1) {
    return duplicateLocalSlugDependency(matchingValues[0].slug)
  }
  const localValue = matchingValues?.[0]
  if (!localValue) return null
  const state = stateByValueId.get(localValue.valueId)
  return {
    key: localValue.valueId,
    slug: localValue.slug,
    valueId: localValue.valueId,
    displayedValue: getDisplayedValue(state),
    hasError: getHasError(state),
    state: state?.status ?? 'pending',
  }
}

function getExternalDependency(
  externalNoteId: SidebarItemId | undefined,
  slug: string,
  referenceableStatesByKey: Map<string, Array<NoteValueRuntimeState<SidebarItemId>>>,
  externalDependencyStatesStatus: ReturnType<
    typeof useNoteValueRuntime
  >['externalDependencyStatesStatus'],
): FormulaDependency | null {
  if (!externalNoteId) return null
  const matchingStates = referenceableStatesByKey.get(getExternalValueKey(externalNoteId, slug))
  if (matchingStates && matchingStates.length > 1) {
    return duplicateExternalSlugDependency({ noteId: externalNoteId, slug })
  }
  const externalState = matchingStates?.[0]
  if (!externalState) {
    if (externalDependencyStatesStatus === 'success') return null
    const hasError = externalDependencyStatesStatus === 'error'
    return {
      key: `${externalNoteId}:${slug}:${externalDependencyStatesStatus}`,
      slug,
      valueId: `${externalNoteId}:${slug}`,
      displayedValue: hasError ? 'Failed to load value' : 'Loading value',
      hasError,
      state: hasError ? 'error' : 'pending',
    }
  }
  return {
    key: `${externalState.noteId}:${externalState.valueId}`,
    slug: externalState.slug,
    valueId: externalState.valueId,
    displayedValue: getDisplayedValue(externalState),
    hasError: getHasError(externalState),
    state: externalState.status,
  }
}

function getReferenceDependency({
  reference,
  localValuesBySlug,
  stateByValueId,
  referenceableStatesByKey,
  externalDependencyStatesStatus,
  noteId,
  resolveNoteIdByPath,
}: {
  reference: FormulaReferenceToken
  localValuesBySlug: Map<string, Array<{ valueId: string; slug: string }>>
  stateByValueId: Map<string, NoteValueRuntimeState<SidebarItemId>>
  referenceableStatesByKey: Map<string, Array<NoteValueRuntimeState<SidebarItemId>>>
  externalDependencyStatesStatus: ReturnType<
    typeof useNoteValueRuntime
  >['externalDependencyStatesStatus']
  noteId: SidebarItemId | undefined
  resolveNoteIdByPath: ReturnType<typeof useNoteValueRuntime>['references']['resolveNoteIdByPath']
}) {
  if (reference.kind === 'self') {
    return getLocalDependency(localValuesBySlug.get(reference.slug), stateByValueId)
  }

  const externalNoteId =
    resolveNoteIdByPath({
      notePathRaw: reference.notePathRaw,
      sourceNoteId: noteId,
    }) ?? undefined
  if (externalNoteId === noteId) {
    return getLocalDependency(localValuesBySlug.get(reference.slug), stateByValueId)
  }

  if (!externalNoteId) {
    return unresolvedExternalDependency({
      notePathRaw: reference.notePathRaw,
      slug: reference.slug,
    })
  }

  return getExternalDependency(
    externalNoteId,
    reference.slug,
    referenceableStatesByKey,
    externalDependencyStatesStatus,
  )
}

function getReferencedDependencies(
  expressionSource: string,
  localValues: Array<{ valueId: string; slug: string }>,
  stateByValueId: Map<string, NoteValueRuntimeState<SidebarItemId>>,
  referenceableStates: Array<NoteValueRuntimeState<SidebarItemId>>,
  externalDependencyStatesStatus: ReturnType<
    typeof useNoteValueRuntime
  >['externalDependencyStatesStatus'],
  noteId: SidebarItemId | undefined,
  resolveNoteIdByPath: ReturnType<typeof useNoteValueRuntime>['references']['resolveNoteIdByPath'],
): FormulaDependenciesResult {
  const dependencies: Array<FormulaDependency> = []
  const seen = new Set<string>()
  const references = collectFormulaReferences(expressionSource)
  const localValuesBySlug = getLocalValuesBySlug(localValues)
  const referenceableStatesByKey = getReferenceableStatesByKey(referenceableStates)

  for (const reference of references) {
    addDependency(
      dependencies,
      seen,
      getReferenceDependency({
        reference,
        localValuesBySlug,
        stateByValueId,
        referenceableStatesByKey,
        externalDependencyStatesStatus,
        noteId,
        resolveNoteIdByPath,
      }),
    )
  }

  return {
    visible: dependencies.slice(0, MAX_VISIBLE_FORMULA_DEPENDENCIES),
    total: dependencies.length,
    hasMore: dependencies.length > MAX_VISIBLE_FORMULA_DEPENDENCIES,
  }
}

function getDisplayedValue(state: NoteValueRuntimeState<SidebarItemId> | undefined) {
  return state?.status === 'ok' ? state.formattedValue : (state?.errorMessage ?? 'No formula')
}

function getHasError(state: NoteValueRuntimeState<SidebarItemId> | undefined) {
  return state?.status === 'error'
}

function SuggestionValueChip({ value }: { value: NoteValueRuntimeState<SidebarItemId> }) {
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

function SuggestionValueChipMeasurement({
  value,
}: {
  value: NoteValueRuntimeState<SidebarItemId>
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-28 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium',
        getHasError(value) && 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <span className="truncate">{value.slug || 'value'}</span>
      <span className="truncate text-muted-foreground">{getDisplayedValue(value)}</span>
    </span>
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
        measurementContent: <SuggestionValueChipMeasurement value={value} />,
      }))}
      getOverflowItem={(hiddenValueCount) => (
        <OverflowValueCountPill hiddenValueCount={hiddenValueCount} />
      )}
      getOverflowMeasurementItem={(hiddenValueCount) => (
        <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {hiddenValueCount} more...
        </span>
      )}
      className="gap-1 pt-0.5"
      itemClassName="inline-flex shrink-0"
    />
  )
}

function useFormulaDependencies({
  expressionSource,
  authoredDefinitions,
  noteId,
  referenceableStates,
  externalDependencyStatesStatus,
  references,
  stateByValueId,
}: {
  expressionSource: string
  authoredDefinitions: ReturnType<typeof useNoteValueRuntime>['authoredDefinitions']
  noteId: ReturnType<typeof useNoteValueRuntime>['noteId']
  referenceableStates: ReturnType<typeof useNoteValueRuntime>['referenceableStates']
  externalDependencyStatesStatus: ReturnType<
    typeof useNoteValueRuntime
  >['externalDependencyStatesStatus']
  references: ReturnType<typeof useNoteValueRuntime>['references']
  stateByValueId: ReturnType<typeof useNoteValueRuntime>['stateByValueId']
}) {
  return getReferencedDependencies(
    expressionSource,
    authoredDefinitions,
    stateByValueId,
    referenceableStates,
    externalDependencyStatesStatus,
    noteId,
    references.resolveNoteIdByPath,
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
      tabIndex={-1}
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
          displayedValue={dependency.displayedValue}
          hasError={dependency.hasError}
          valueId={dependency.valueId}
          state={dependency.state}
          title={dependency.hasError ? dependency.displayedValue : undefined}
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
  const {
    authoredDefinitions,
    externalDependencyStatesStatus,
    noteId,
    referenceableStates,
    references,
    stateByValueId,
  } = useNoteValueRuntime()
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
    externalDependencyStatesStatus,
    noteId,
    referenceableStates,
    references,
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
          externalValuesPending={referenceAuthoring.referenceableValuesStatus === 'pending'}
          applySuggestion={applySuggestion}
        />
      ) : null}

      <FormulaDependencyChips dependencies={dependencies} />
    </div>
  )
}
