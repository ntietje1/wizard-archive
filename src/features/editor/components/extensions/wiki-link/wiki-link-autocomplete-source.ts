import type { Id } from 'convex/_generated/dataModel'
import type {
  AutocompleteContext,
  buildWikiLinkAutocompleteModel,
} from './wiki-link-autocomplete-model'

export interface WikiLinkAutocompleteMenuState {
  show: boolean
  query: string
  pos: DOMRect | null
}

export interface WikiLinkAutocompleteModelData {
  context: AutocompleteContext | null
  headingsPending: boolean
  model: ReturnType<typeof buildWikiLinkAutocompleteModel>
  valuesPending: boolean
}

export type WikiLinkAutocompleteModelDataArgs = {
  menu: WikiLinkAutocompleteMenuState
  sourceNoteId?: Id<'sidebarItems'>
}
