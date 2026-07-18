import type { ReactNode } from 'react'
import { NoteEmbedRuntimeContext } from './note-embed-runtime-context'
import type { NoteEmbedBinding } from './note-embed-runtime-context'

export function NoteEmbedRuntimeProvider({
  binding,
  children,
  editable,
}: {
  binding?: NoteEmbedBinding
  children: ReactNode
  editable: boolean
}) {
  const ancestry = new Set(binding?.ancestors)
  if (binding) ancestry.add(binding.sourceResourceId)
  return (
    <NoteEmbedRuntimeContext.Provider
      value={{
        ancestry,
        editable,
        drop: binding?.drop ?? null,
        renderNote: binding?.renderNote ?? null,
        runtime: binding?.runtime ?? null,
      }}
    >
      {children}
    </NoteEmbedRuntimeContext.Provider>
  )
}
