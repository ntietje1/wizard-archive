import type { FormulaReferenceToken, NoteValueErrorCode } from './model'

export class FormulaError extends Error {
  constructor(
    readonly errorCode: NoteValueErrorCode,
    readonly errorMessage: string,
  ) {
    super(errorMessage)
  }
}

export class FormulaReferenceError extends FormulaError {
  constructor(
    errorCode: NoteValueErrorCode,
    errorMessage: string,
    readonly reference: FormulaReferenceToken,
  ) {
    super(errorCode, errorMessage)
  }
}

export function normalizeFormulaError(error: unknown): {
  errorCode: NoteValueErrorCode
  errorMessage: string
} {
  if (error instanceof FormulaError) {
    return {
      errorCode: error.errorCode,
      errorMessage: error.errorMessage,
    }
  }

  if (!(error instanceof Error)) {
    return { errorCode: 'parse_error', errorMessage: 'Invalid expression' }
  }
  return {
    errorCode: 'parse_error',
    errorMessage: error.message,
  }
}
