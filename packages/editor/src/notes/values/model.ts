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

export type FormulaReferenceToken =
  | { kind: 'self'; slug: string }
  | { kind: 'external'; notePathRaw: string; slug: string }
