import { api } from 'convex/_generated/api'
import {
  getExternalNoteIdByPathForDefinitions,
  useEditorNoteValueDefinitions,
} from './note-value-runtime-source'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteValueRuntimeState } from '../../../../shared/note-values/types'
import type { NoteValueRuntimeSource } from './note-value-runtime-source'

const EMPTY_ITEMS: NoteValueRuntimeSource['sidebarItems'] = []

export function useLiveNoteValueRuntimeSource({
  editor,
  noteId,
}: {
  editor: CustomBlockNoteEditor | null
  noteId?: Id<'sidebarItems'>
}): NoteValueRuntimeSource {
  const { data: sidebarItemsData, itemsMap } = useFilteredSidebarItems()
  const sidebarItems = sidebarItemsData ?? EMPTY_ITEMS
  const authoredDefinitions = useEditorNoteValueDefinitions({ editor, noteId })

  const externalNoteIdByPath = noteId
    ? getExternalNoteIdByPathForDefinitions({
        definitions: authoredDefinitions,
        noteId,
        sidebarItems,
        itemsMap,
      })
    : new Map<string, Id<'sidebarItems'>>()
  const externalNoteIds = [...new Set(externalNoteIdByPath.values())].filter((id) => id !== noteId)

  const persistedStatesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStates,
    noteId ? { noteId } : 'skip',
  )
  const externalStatesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    externalNoteIds.length > 0 ? { noteIds: externalNoteIds } : 'skip',
  )

  return {
    noteId,
    authoredDefinitions,
    externalNoteIdByPath,
    externalStates: (externalStatesQuery.data ?? []) as Array<
      NoteValueRuntimeState<Id<'sidebarItems'>>
    >,
    itemsMap,
    persistedStates: (persistedStatesQuery.data ?? []) as Array<
      NoteValueRuntimeState<Id<'sidebarItems'>>
    >,
    sidebarItems,
  }
}
