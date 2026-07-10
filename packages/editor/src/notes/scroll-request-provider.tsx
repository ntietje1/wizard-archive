import type { ReactNode } from 'react'
import type { NoteScrollRequest } from './runtime'
import { NoteScrollRequestContext } from './scroll-request-context'

export function NoteScrollRequestProvider({
  children,
  value,
}: {
  children: ReactNode
  value: NoteScrollRequest
}) {
  return (
    <NoteScrollRequestContext.Provider value={value}>{children}</NoteScrollRequestContext.Provider>
  )
}
