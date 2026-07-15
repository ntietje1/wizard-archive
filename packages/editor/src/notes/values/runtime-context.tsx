import { useEffect, useState } from 'react'
import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core'
import type { ReactNode } from 'react'
import { evaluateNoteValues, extractNoteValues } from './runtime'
import { NoteValueRuntimeContext } from './value-runtime-context'
import type { NoteValueRuntime } from './value-runtime-context'

export function NoteValueRuntimeProvider<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>({
  children,
  editor,
  editable,
}: {
  children: ReactNode
  editor: BlockNoteEditor<BSchema, ISchema, SSchema>
  editable: boolean
}) {
  const [blocks, setBlocks] = useState(() => editor.document)
  useEffect(() => editor.onChange((changedEditor) => setBlocks(changedEditor.document)), [editor])
  const definitions = extractNoteValues(blocks)
  const value: NoteValueRuntime = {
    editable,
    definitions,
    states: evaluateNoteValues(definitions),
  }
  return (
    <NoteValueRuntimeContext.Provider value={value}>{children}</NoteValueRuntimeContext.Provider>
  )
}
