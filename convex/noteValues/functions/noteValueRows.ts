import type {
  NoteValueCompiledFormula,
  NoteValueDefinition,
} from '../../../shared/note-values/types'
import type { Doc, Id } from '../../_generated/dataModel'

export function noteValueRowToDefinition(
  row: Doc<'noteValues'>,
): NoteValueDefinition<Id<'sidebarItems'>> {
  return {
    noteId: row.noteId,
    blockNoteId: row.blockNoteId,
    valueId: row.valueId,
    slug: row.slug,
    expressionSource: row.expressionSource,
    compiledFormula: row.compiledFormula as NoteValueCompiledFormula | null,
    bindings: row.bindings,
    compileStatus: row.compileStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  }
}
