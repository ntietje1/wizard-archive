import { describe, expect, it } from 'vitest'
import { NOTE_VALUE_FUNCTIONS } from '../../../shared/note-values/constants'
import {
  applyFormulaAutocompleteInsertion,
  buildExternalNoteValuePrefix,
  buildSameNoteValueReference,
  getFormulaAutocompleteContext,
  rewriteSameNoteValueReferences,
} from '../../../shared/note-values/authoring'

describe('note value formula authoring helpers', () => {
  it('exposes function metadata used by authoring autocomplete', () => {
    expect(NOTE_VALUE_FUNCTIONS.map((fn) => fn.name)).toEqual([
      'min',
      'max',
      'round',
      'floor',
      'ceil',
      'abs',
    ])
    expect(NOTE_VALUE_FUNCTIONS.find((fn) => fn.name === 'floor')).toMatchObject({
      signature: 'floor(value)',
      snippet: 'floor()',
      minArgs: 1,
      maxArgs: 1,
    })
  })

  it('detects autocomplete contexts for functions and bracketed refs', () => {
    expect(getFormulaAutocompleteContext('strength_mod + prof', 19)).toMatchObject({
      kind: 'identifier',
      query: 'prof',
      replaceFrom: 15,
      replaceTo: 19,
    })
    expect(getFormulaAutocompleteContext('[[Character', 11)).toMatchObject({
      kind: 'external_note',
      query: 'Character',
      replaceFrom: 0,
      replaceTo: 11,
    })
    expect(getFormulaAutocompleteContext('[[Character.pro', 15)).toMatchObject({
      kind: 'external_value',
      notePathRaw: 'Character',
      query: 'pro',
      replaceFrom: 12,
      replaceTo: 15,
    })
  })

  it('applies autocomplete insertions and places the cursor inside function calls', () => {
    const context = getFormulaAutocompleteContext('flo', 3)
    expect(context).not.toBeNull()
    expect(applyFormulaAutocompleteInsertion('flo', context!, 'floor()')).toEqual({
      expressionSource: 'floor()',
      cursorPosition: 6,
    })
  })

  it('uses a forced selected range as the autocomplete replacement range', () => {
    expect(getFormulaAutocompleteContext('1 + prof', 4, { force: true, selectionEnd: 8 })).toEqual({
      kind: 'identifier',
      query: '',
      replaceFrom: 4,
      replaceTo: 8,
    })
  })

  it('replaces an existing closed same-note reference without duplicating closing brackets', () => {
    const source = '[[str]] + 1'
    const context = getFormulaAutocompleteContext(source, 5)

    expect(context).toMatchObject({
      kind: 'external_note',
      query: 'str',
      replaceFrom: 0,
      replaceTo: 7,
    })
    expect(applyFormulaAutocompleteInsertion(source, context!, '[[strength]]')).toEqual({
      expressionSource: '[[strength]] + 1',
      cursorPosition: 12,
    })
  })

  it('replaces an existing closed external value reference without duplicating closing brackets', () => {
    const source = '[[Character.pro]] + 1'
    const context = getFormulaAutocompleteContext(source, 15)

    expect(context).toMatchObject({
      kind: 'external_value',
      notePathRaw: 'Character',
      query: 'pro',
      replaceFrom: 12,
      replaceTo: 17,
    })
    expect(applyFormulaAutocompleteInsertion(source, context!, 'prof-bonus]]')).toEqual({
      expressionSource: '[[Character.prof-bonus]] + 1',
      cursorPosition: 24,
    })
  })

  it('builds shared formula reference insertion strings', () => {
    expect(buildSameNoteValueReference('strength_mod')).toBe('[[strength_mod]]')
    expect(buildExternalNoteValuePrefix('Characters/Fighter')).toBe('[[Characters/Fighter.')
  })

  it('rewrites same-note references without changing external references', () => {
    expect(
      rewriteSameNoteValueReferences(
        '[[base]] + [[Characters/Base.base]] + [[bonus]]',
        new Map([
          ['base', 'base_2'],
          ['bonus', 'bonus_2'],
        ]),
      ),
    ).toBe('[[base_2]] + [[Characters/Base.base]] + [[bonus_2]]')
  })
})
