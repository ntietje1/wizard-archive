import { createContext } from 'react'
import type { NoteValueDefinition, NoteValueState } from './runtime'

export type NoteValueRuntime = Readonly<{
  editable: boolean
  definitions: ReadonlyArray<NoteValueDefinition>
  states: ReadonlyMap<string, NoteValueState>
}>

export const NoteValueRuntimeContext = createContext<NoteValueRuntime>({
  editable: false,
  definitions: [],
  states: new Map(),
})
