import type { NoteValueProps } from './schema'

export const NOTE_VALUE_ERROR_CODES = [
  'empty_expression',
  'parse_error',
  'invalid_function_usage',
  'unknown_reference',
  'missing_target',
  'duplicate_slug',
  'duplicate_value_id',
  'cyclic_dependency',
  'dependency_error',
  'division_by_zero',
  'non_finite_result',
  'invalid_slug',
] as const

export type NoteValueErrorCode = (typeof NOTE_VALUE_ERROR_CODES)[number]

export interface NoteValueBinding<TNoteId = string> {
  key: string
  targetNoteId: TNoteId
  targetValueId: string
}

export type NoteValueCompiledFormula =
  | { kind: 'number'; value: number }
  | { kind: 'binding'; key: string }
  | { kind: 'unary'; operator: '+' | '-'; argument: NoteValueCompiledFormula }
  | {
      kind: 'binary'
      operator: '+' | '-' | '*' | '/'
      left: NoteValueCompiledFormula
      right: NoteValueCompiledFormula
    }
  | { kind: 'call'; callee: string; args: Array<NoteValueCompiledFormula> }

export type PersistedNoteValueCompiledFormula = NoteValueCompiledFormula

export interface NoteValueCompileData<TNoteId = string> {
  compiledFormula: NoteValueCompiledFormula | null
  bindings: Array<NoteValueBinding<TNoteId>>
  compileStatus: 'ok' | 'error'
  errorCode: NoteValueErrorCode | null
  errorMessage: string | null
  unresolvedReference?: FormulaReferenceToken | null
}

export interface NoteValueAuthoringDefinition<TNoteId = string> extends NoteValueProps {
  noteId: TNoteId
  blockNoteId: string
}

export interface NoteValueDefinition<TNoteId = string>
  extends NoteValueAuthoringDefinition<TNoteId>, NoteValueCompileData<TNoteId> {}

export interface NoteValueRuntimeState<TNoteId = string> {
  noteId: TNoteId
  blockNoteId: string
  valueId: string
  slug: string
  status: 'ok' | 'error'
  rawValue: number | null
  formattedValue: string
  errorCode: NoteValueErrorCode | null
  errorMessage: string | null
}

export type NoteValueResolution<TNoteId = string> =
  | { ok: true; noteId: TNoteId; valueId: string }
  | { ok: false; errorCode: NoteValueErrorCode; errorMessage: string }

export type FormulaReferenceToken =
  | { kind: 'self'; slug: string }
  | { kind: 'external'; notePathRaw: string; slug: string }
