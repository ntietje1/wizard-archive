import { useContext } from 'react'
import { NoteValueRuntimeContext } from './value-runtime-context'

export function useNoteValueRuntime() {
  return useContext(NoteValueRuntimeContext)
}
