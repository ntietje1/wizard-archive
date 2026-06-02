import { createContext, use } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type {
  NoteValueAuthoringDefinition,
  NoteValueRuntimeState,
} from '../../../../shared/note-values/types'

interface NoteValueRuntimeContextValue {
  noteId?: Id<'sidebarItems'>
  editable: boolean
  authoredDefinitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  authoredValueStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  stateByValueId: Map<string, NoteValueRuntimeState<Id<'sidebarItems'>>>
  sidebarItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
}

export const NoteValueRuntimeContext = createContext<NoteValueRuntimeContextValue | null>(null)

export function useNoteValueRuntime() {
  const context = use(NoteValueRuntimeContext)
  if (!context) {
    throw new Error('useNoteValueRuntime must be used inside NoteValueRuntimeProvider')
  }
  return context
}
