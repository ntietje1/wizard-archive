import { NOTE_VALUE_FUNCTIONS } from '../values/constants'
import type { FormulaAutocompleteContext } from '../values/authoring'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { filterSuggestionItems } from '../../rich-text/filter-suggestion-items'
import type { ValueReferenceCandidate } from './use-value-reference-authoring'

const MAX_VALUE_SUGGESTIONS = 8
const MAX_FORMULA_SUGGESTIONS = 10

export interface FormulaSuggestion {
  key: string
  kind: 'value' | 'function' | 'note' | 'external_value'
  title: string
  detail: string
  insertText: string
  previewValues?: Array<NoteValueRuntimeState<SidebarItemId>>
}

export function getFormulaSuggestions({
  context,
  sameNoteCandidates,
  noteCandidates,
  externalValueCandidates,
}: {
  context: FormulaAutocompleteContext | null
  sameNoteCandidates: Array<ValueReferenceCandidate>
  noteCandidates: Array<ValueReferenceCandidate>
  externalValueCandidates: Array<ValueReferenceCandidate>
}): Array<FormulaSuggestion> {
  if (!context) return []

  if (context.kind === 'external_note') {
    const valueItems = sameNoteCandidates.map((candidate) => ({
      ...candidate,
      kind: 'value' as const,
    }))
    const noteItems = noteCandidates.map((candidate) => ({ ...candidate, kind: 'note' as const }))
    return filterSuggestionItems([...valueItems, ...noteItems], context.query).slice(
      0,
      MAX_VALUE_SUGGESTIONS,
    )
  }

  if (context.kind === 'external_value') {
    return filterSuggestionItems(
      externalValueCandidates.map((candidate) => ({
        ...candidate,
        kind: 'external_value' as const,
      })),
      context.query,
    ).slice(0, MAX_VALUE_SUGGESTIONS)
  }

  const valueItems = sameNoteCandidates.map((candidate) => ({
    ...candidate,
    kind: 'value' as const,
  }))
  const filteredValues = filterSuggestionItems(valueItems, context.query)

  const functionItems = NOTE_VALUE_FUNCTIONS.map((fn) => ({
    key: `function-${fn.name}`,
    title: fn.name,
    aliases: [fn.signature],
    kind: 'function' as const,
    detail: fn.signature,
    insertText: fn.snippet,
  }))
  return [...filteredValues, ...filterSuggestionItems(functionItems, context.query)].slice(
    0,
    MAX_FORMULA_SUGGESTIONS,
  )
}
