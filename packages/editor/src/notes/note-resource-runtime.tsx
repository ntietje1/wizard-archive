import type { ReactNode } from 'react'
import type * as Y from 'yjs'
import { NoteResourceRuntimeContext } from './note-resource-runtime-context'
import type { NoteResourceBinding } from './note-resource-runtime-context'

export function NoteResourceRuntimeProvider({
  binding,
  children,
  document,
  editable,
}: {
  binding?: NoteResourceBinding
  children: ReactNode
  document?: Y.Doc
  editable: boolean
}) {
  const ancestry = new Set(binding?.ancestors)
  if (binding) ancestry.add(binding.sourceResourceId)
  return (
    <NoteResourceRuntimeContext.Provider
      value={{
        ancestry,
        document: document ?? null,
        editable,
        drop: binding?.drop ?? null,
        report: binding?.report ?? null,
        renderNote: binding?.renderNote ?? null,
        runtime: binding?.runtime ?? null,
        sourceResourceId: binding?.sourceResourceId ?? null,
      }}
    >
      {children}
    </NoteResourceRuntimeContext.Provider>
  )
}
