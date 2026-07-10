import type { NoteValueDefinition } from '@wizard-archive/editor/notes/values-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import { resolveStoredNoteValueCompileState } from '../compileState'

export function noteValueRowToDefinition(
  row: Doc<'noteValues'>,
): NoteValueDefinition<Id<'sidebarItems'>> {
  return {
    noteId: row.noteId,
    noteBlockId: row.blockNoteId,
    valueId: row.valueId,
    slug: row.slug,
    expressionSource: row.expressionSource,
    compile: resolveStoredNoteValueCompileState(row),
  }
}
