import { createContext, use } from 'react'
import type { NoteValueReferences, NoteValueStatesForNotesStatus } from '../value-runtime-model'
import type { NoteValueAuthoringDefinition } from '../values/runtime'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'

export interface NoteValueRuntimeContextValue {
  noteId?: SidebarItemId
  editable: boolean
  authoredDefinitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  authoredValueStates: Array<NoteValueRuntimeState<SidebarItemId>>
  externalDependencyStates: Array<NoteValueRuntimeState<SidebarItemId>>
  externalDependencyStatesStatus: NoteValueStatesForNotesStatus
  referenceableStates: Array<NoteValueRuntimeState<SidebarItemId>>
  referenceableStatesStatus: NoteValueStatesForNotesStatus
  stateByValueId: Map<string, NoteValueRuntimeState<SidebarItemId>>
  references: NoteValueReferences
}

export const NoteValueRuntimeContext = createContext<NoteValueRuntimeContextValue | null>(null)

export function useNoteValueRuntime() {
  const context = use(NoteValueRuntimeContext)
  if (!context) {
    throw new Error('useNoteValueRuntime must be used inside NoteValueRuntimeProvider')
  }
  return context
}
