import { useContext } from 'react'
import { NoteEmbedRuntimeContext } from './note-embed-runtime-context'

export function useNoteEmbedRuntime() {
  const runtime = useContext(NoteEmbedRuntimeContext)
  if (!runtime) throw new Error('Note embed rendered outside a note editor')
  return runtime
}
