import { isNoteValueCompiledFormula } from '@wizard-archive/editor/notes/values-contract'
import type {
  NoteValueBinding,
  NoteValueCompileState,
  NoteValueErrorCode,
} from '@wizard-archive/editor/notes/values-contract'

type StoredNoteValueCompileState<TNoteId> = {
  compile:
    | { status: 'ok'; formula: unknown; bindings: Array<NoteValueBinding<TNoteId>> }
    | { status: 'error'; errorCode: NoteValueErrorCode; errorMessage: string }
}

type LegacyStoredNoteValueCompileFields<TNoteId> = {
  compile?:
    | { status: 'ok'; formula: unknown; bindings: Array<NoteValueBinding<TNoteId>> }
    | { status: 'error'; errorCode: NoteValueErrorCode; errorMessage: string }
  compiledFormula?: unknown
  bindings?: Array<NoteValueBinding<TNoteId>>
  compileStatus?: 'ok' | 'error'
  errorCode?: NoteValueErrorCode | null
  errorMessage?: string | null
}

const INVALID_PERSISTED_FORMULA_MESSAGE = 'Invalid persisted formula'

export function resolveStoredNoteValueCompileState<TNoteId>(
  stored: StoredNoteValueCompileState<TNoteId>,
): NoteValueCompileState<TNoteId> {
  if (stored.compile.status === 'error') return stored.compile
  if (isNoteValueCompiledFormula(stored.compile.formula)) {
    return { ...stored.compile, formula: stored.compile.formula }
  }
  return {
    status: 'error',
    errorCode: 'parse_error',
    errorMessage: INVALID_PERSISTED_FORMULA_MESSAGE,
  }
}

function resolveLegacyNoteValueCompileState<TNoteId>(
  stored: LegacyStoredNoteValueCompileFields<TNoteId>,
): NoteValueCompileState<TNoteId> {
  if (stored.compile) return resolveStoredNoteValueCompileState({ compile: stored.compile })
  if (stored.compileStatus === 'error') {
    return {
      status: 'error',
      errorCode: stored.errorCode ?? 'parse_error',
      errorMessage: stored.errorMessage ?? INVALID_PERSISTED_FORMULA_MESSAGE,
    }
  }
  if (isNoteValueCompiledFormula(stored.compiledFormula)) {
    return {
      status: 'ok',
      formula: stored.compiledFormula,
      bindings: stored.bindings ?? [],
    }
  }
  return {
    status: 'error',
    errorCode: 'parse_error',
    errorMessage: INVALID_PERSISTED_FORMULA_MESSAGE,
  }
}

export function requireValidNoteValueCompileState<TNoteId>(
  compile: NoteValueCompileState<TNoteId>,
): NoteValueCompileState<TNoteId> {
  if (compile.status === 'ok' && !isNoteValueCompiledFormula(compile.formula)) {
    throw new Error(INVALID_PERSISTED_FORMULA_MESSAGE)
  }
  return compile
}

export function getNoteValueCompileStateMigrationPatch<TNoteId>(
  stored: LegacyStoredNoteValueCompileFields<TNoteId>,
): { compile: NoteValueCompileState<TNoteId> } | undefined {
  return stored.compile ? undefined : { compile: resolveLegacyNoteValueCompileState(stored) }
}

export function getLegacyNoteValueCompileFieldsCleanupPatch(storedValue: object) {
  const stored = storedValue as {
    compiledFormula?: unknown
    bindings?: unknown
    compileStatus?: unknown
    errorCode?: unknown
    errorMessage?: unknown
  }
  if (
    stored.compiledFormula === undefined &&
    stored.bindings === undefined &&
    stored.compileStatus === undefined &&
    stored.errorCode === undefined &&
    stored.errorMessage === undefined
  ) {
    return undefined
  }
  return {
    compiledFormula: undefined,
    bindings: undefined,
    compileStatus: undefined,
    errorCode: undefined,
    errorMessage: undefined,
  }
}
