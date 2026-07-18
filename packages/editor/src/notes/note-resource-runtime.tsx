import type { ReactNode } from 'react'
import { NoteResourceRuntimeContext } from './note-resource-runtime-context'
import type { NoteResourceBinding } from './note-resource-runtime-context'

export function NoteResourceRuntimeProvider({
  binding,
  children,
  editable,
}: {
  binding?: NoteResourceBinding
  children: ReactNode
  editable: boolean
}) {
  const ancestry = new Set(binding?.ancestors)
  if (binding) ancestry.add(binding.sourceResourceId)
  return (
    <NoteResourceRuntimeContext.Provider
      value={{
        ancestry,
        editable,
        drop: binding?.drop ?? null,
        renderNote: binding?.renderNote ?? null,
        runtime: binding?.runtime ?? null,
      }}
    >
      {children}
    </NoteResourceRuntimeContext.Provider>
  )
}
