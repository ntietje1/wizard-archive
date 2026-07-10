import { use } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { Heading } from '../document/model'
import type { NoteValueRuntimeState } from '../values/state-contract'
import {
  buildWikiLinkAutocompleteModelFromSource,
  getWikiLinkAutocompleteContextFromSource,
} from './autocomplete-model'
import type { AutocompleteContext, WikiLinkAutocompleteItemSource } from './autocomplete-model'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'

export interface WikiLinkAutocompleteMenuState {
  show: boolean
  query: string
  pos: DOMRect | null
}

export interface WikiLinkAutocompleteModelData {
  context: AutocompleteContext | null
  headingsPending: boolean
  model: ReturnType<typeof buildWikiLinkAutocompleteModelFromSource>
  valuesPending: boolean
}

export type WikiLinkAutocompleteModelDataArgs = {
  menu: WikiLinkAutocompleteMenuState
  sourceNoteId?: SidebarItemId
}

interface WikiLinkAutocompleteState {
  context: AutocompleteContext | null
  itemSource: WikiLinkAutocompleteItemSource
  valueRuntime: NoteValueRuntimeContextValue | null
}

interface WikiLinkAutocompleteLoad {
  headings: Array<Heading>
  headingsPending: boolean
  persistedValues?: Array<NoteValueRuntimeState<SidebarItemId>>
  persistedValuesPending: boolean
}

interface WikiLinkAutocompleteLoadRequest {
  headingsNoteId: SidebarItemId | null
  persistedValuesNoteId: SidebarItemId | null
}

interface WikiLinkAutocompleteModelDataInput
  extends WikiLinkAutocompleteState, WikiLinkAutocompleteLoad {}

export function useWikiLinkAutocompleteState({
  itemSource,
  menu,
  sourceNoteId,
}: WikiLinkAutocompleteModelDataArgs & {
  itemSource: WikiLinkAutocompleteItemSource
}): WikiLinkAutocompleteState {
  const valueRuntime = use(NoteValueRuntimeContext)
  const context = menu.show
    ? getWikiLinkAutocompleteContextFromSource(menu.query, itemSource, sourceNoteId)
    : null

  return { context, itemSource, valueRuntime }
}

export function createWikiLinkAutocompleteModelData({
  context,
  headings,
  headingsPending,
  itemSource,
  persistedValues = [],
  persistedValuesPending,
  valueRuntime,
}: WikiLinkAutocompleteModelDataInput): WikiLinkAutocompleteModelData {
  const selectedValueNoteId = context?.mode === 'value' ? context.resolvedItem.id : null
  const loadRequest = getWikiLinkAutocompleteLoadRequest({ context, valueRuntime })
  const values =
    selectedValueNoteId !== null && loadRequest.persistedValuesNoteId === null
      ? (valueRuntime?.authoredValueStates ?? [])
      : persistedValues

  return {
    context,
    headingsPending,
    model: buildWikiLinkAutocompleteModelFromSource({
      context,
      itemSource,
      headings,
      values,
    }),
    valuesPending: loadRequest.persistedValuesNoteId !== null ? persistedValuesPending : false,
  }
}

export function getWikiLinkAutocompleteLoadRequest({
  context,
  valueRuntime,
}: Pick<WikiLinkAutocompleteState, 'context' | 'valueRuntime'>): WikiLinkAutocompleteLoadRequest {
  const headingsNoteId = context?.mode === 'heading' ? context.resolvedItem.id : null
  const selectedValueNoteId = context?.mode === 'value' ? context.resolvedItem.id : null
  return {
    headingsNoteId,
    persistedValuesNoteId:
      selectedValueNoteId !== null && selectedValueNoteId !== valueRuntime?.noteId
        ? selectedValueNoteId
        : null,
  }
}
