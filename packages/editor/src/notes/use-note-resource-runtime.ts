import { useContext } from 'react'
import { NoteResourceRuntimeContext } from './note-resource-runtime-context'

export function useNoteResourceRuntime() {
  const runtime = useContext(NoteResourceRuntimeContext)
  if (!runtime) throw new Error('Note embed rendered outside a note editor')
  return runtime
}
