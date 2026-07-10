import { createContext, use } from 'react'
import type { NoteScrollRequest } from './runtime'

const NO_NOTE_SCROLL_REQUEST: NoteScrollRequest = { status: 'none' }

export const NoteScrollRequestContext = createContext<NoteScrollRequest>(NO_NOTE_SCROLL_REQUEST)

export function useNoteScrollRequest() {
  return use(NoteScrollRequestContext)
}
