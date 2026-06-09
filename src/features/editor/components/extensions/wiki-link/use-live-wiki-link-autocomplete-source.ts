import { use } from 'react'
import { api } from 'convex/_generated/api'
import {
  buildWikiLinkAutocompleteModel,
  getWikiLinkAutocompleteContext,
} from './wiki-link-autocomplete-model'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { NoteValueRuntimeContext } from '~/features/editor/value-block/value-block-runtime-context'
import type {
  WikiLinkAutocompleteModelData,
  WikiLinkAutocompleteModelDataArgs,
} from './wiki-link-autocomplete-source'

export function useLiveWikiLinkAutocompleteModelData({
  menu,
  sourceNoteId,
}: WikiLinkAutocompleteModelDataArgs): WikiLinkAutocompleteModelData {
  const { data: sidebarItems, itemsMap } = useFilteredSidebarItems()
  const valueRuntime = use(NoteValueRuntimeContext)
  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined
  const context = menu.show
    ? getWikiLinkAutocompleteContext(menu.query, sidebarItems, itemsMap, sourceParentId)
    : null

  const headingsQuery = useCampaignQuery(
    api.blocks.queries.getHeadingsByNote,
    context?.mode === 'heading' ? { noteId: context.resolvedItem._id } : 'skip',
  )

  const selectedValueNoteId = context?.mode === 'value' ? context.resolvedItem._id : null
  const shouldLoadPersistedValues =
    selectedValueNoteId !== null && selectedValueNoteId !== valueRuntime?.noteId
  const valuesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStates,
    shouldLoadPersistedValues ? { noteId: selectedValueNoteId } : 'skip',
  )
  const values =
    selectedValueNoteId !== null && selectedValueNoteId === valueRuntime?.noteId
      ? valueRuntime.authoredValueStates
      : (valuesQuery.data ?? [])

  return {
    context,
    headingsPending: headingsQuery.isPending,
    model: buildWikiLinkAutocompleteModel({
      context,
      sidebarItems,
      itemsMap,
      headings: headingsQuery.data ?? [],
      values,
    }),
    valuesPending: valuesQuery.isPending,
  }
}
