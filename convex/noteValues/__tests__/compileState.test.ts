import { describe, expect, it } from 'vitest'
import type { NoteValueCompileState } from '@wizard-archive/editor/notes/values-contract'
import {
  getNoteValueCompileStateMigrationPatch,
  requireValidNoteValueCompileState,
  resolveStoredNoteValueCompileState,
} from '../compileState'

const recursiveCompileState: NoteValueCompileState<string> = {
  status: 'ok',
  formula: {
    kind: 'binary',
    operator: '+',
    left: {
      kind: 'unary',
      operator: '-',
      argument: { kind: 'number', value: 2 },
    },
    right: {
      kind: 'call',
      callee: 'max',
      args: [
        { kind: 'binding', key: 'ref_0' },
        { kind: 'number', value: 1 },
      ],
    },
  },
  bindings: [{ key: 'ref_0', targetNoteId: 'note-2', targetValueId: 'value-2' }],
}

describe('persisted note value compile state', () => {
  it('preserves recursively valid compiled formulas', () => {
    expect(resolveStoredNoteValueCompileState({ compile: recursiveCompileState })).toEqual(
      recursiveCompileState,
    )
  })

  it('fails closed when a nested compiled formula node is malformed', () => {
    expect(
      resolveStoredNoteValueCompileState({
        compile: {
          status: 'ok',
          formula: {
            kind: 'binary',
            operator: '+',
            left: { kind: 'number', value: 1 },
            right: { kind: 'call', callee: 'max', args: [{ kind: 'unknown' }] },
          },
          bindings: [],
        },
      }),
    ).toEqual({
      status: 'error',
      errorCode: 'parse_error',
      errorMessage: 'Invalid persisted formula',
    })
  })

  it('rejects malformed recursive formulas before persistence', () => {
    const malformed = {
      status: 'ok',
      formula: { kind: 'unary', operator: '-', argument: { kind: 'unknown' } },
      bindings: [],
    } as unknown as NoteValueCompileState<string>

    expect(() => requireValidNoteValueCompileState(malformed)).toThrow('Invalid persisted formula')
  })

  it('migrates legacy recursive formulas into the discriminated state', () => {
    expect(
      getNoteValueCompileStateMigrationPatch({
        compileStatus: 'ok',
        compiledFormula: recursiveCompileState.status === 'ok' && recursiveCompileState.formula,
        bindings: recursiveCompileState.status === 'ok' ? recursiveCompileState.bindings : [],
      }),
    ).toEqual({ compile: recursiveCompileState })
  })
})
