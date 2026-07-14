import type { ResourceId } from '../../resources/domain-id'
import { createContext, use } from 'react'
import type { NoteValueReferences, NoteValueStatesForNotesStatus } from '../value-runtime-model'
import type { NoteValueAuthoringDefinition } from '../values/runtime'
import type { NoteValueRuntimeState } from '../values/state-contract'

export interface NoteValueRuntimeContextValue {
  noteId?: ResourceId
  editable: boolean
  authoredDefinitions: Array<NoteValueAuthoringDefinition<ResourceId>>
  authoredValueStates: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStates: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStatesStatus: NoteValueStatesForNotesStatus
  referenceableStates: Array<NoteValueRuntimeState<ResourceId>>
  referenceableStatesStatus: NoteValueStatesForNotesStatus
  stateByValueId: Map<string, NoteValueRuntimeState<ResourceId>>
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
