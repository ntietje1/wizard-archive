import { isNoteValueCompiledFormula } from '../../../shared/note-values/formula'
import type { NoteValueDefinition } from '../../../shared/note-values/types'
import type { Doc, Id } from '../../_generated/dataModel'
import { logger } from '../../common/logger'

function summarizeCompiledFormula(value: unknown): string {
  try {
    const serialized = JSON.stringify(value)
    return (serialized ?? String(value)).slice(0, 200)
  } catch {
    return String(value).slice(0, 200)
  }
}

function compiledFormulaFromRow(row: Doc<'noteValues'>) {
  if (!row.compiledFormula) return null
  if (isNoteValueCompiledFormula(row.compiledFormula)) return row.compiledFormula

  logger.warn('Ignoring invalid note value compiledFormula', {
    rowId: row._id,
    noteId: row.noteId,
    blockNoteId: row.blockNoteId,
    valueId: row.valueId,
    compiledFormula: summarizeCompiledFormula(row.compiledFormula),
  })
  return null
}

export function noteValueRowToDefinition(
  row: Doc<'noteValues'>,
): NoteValueDefinition<Id<'sidebarItems'>> {
  return {
    noteId: row.noteId,
    blockNoteId: row.blockNoteId,
    valueId: row.valueId,
    slug: row.slug,
    expressionSource: row.expressionSource,
    compiledFormula: compiledFormulaFromRow(row),
    bindings: row.bindings,
    compileStatus: row.compileStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  }
}
