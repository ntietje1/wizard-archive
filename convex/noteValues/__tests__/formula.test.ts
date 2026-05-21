import { describe, expect, it } from 'vitest'
import { formatNoteValue } from '../../../shared/note-values/constants'
import {
  collectFormulaReferences,
  compileNoteValueDefinitions,
  evaluateNoteValueDefinitions,
} from '../../../shared/note-values/formula'
import type {
  NoteValueAuthoringDefinition,
  NoteValueDefinition,
  NoteValueResolution,
  NoteValueRuntimeState,
} from '../../../shared/note-values/types'

function authoredValue(
  noteId: string,
  blockNoteId: string,
  valueId: string,
  slug: string,
  expressionSource: string,
  _label?: string,
): NoteValueAuthoringDefinition<string> {
  return {
    noteId,
    blockNoteId,
    valueId,
    slug,
    expressionSource,
  }
}

function compileDefinitions(
  definitions: Array<NoteValueAuthoringDefinition<string>>,
  overrides?: Partial<{
    resolveExternal: (notePathRaw: string, slug: string) => NoteValueResolution<string>
  }>,
) {
  return compileNoteValueDefinitions(definitions, {
    currentNoteId: 'note-1',
    resolveExternal:
      overrides?.resolveExternal ??
      (() => ({
        ok: false,
        errorCode: 'unknown_reference',
        errorMessage: 'unused',
      })),
  })
}

function evaluateDefinitions(
  definitions: Array<NoteValueDefinition<string>>,
  getDependencyState: (
    noteId: string,
    valueId: string,
  ) => NoteValueRuntimeState<string> | null = () => null,
) {
  return evaluateNoteValueDefinitions(definitions, getDependencyState)
}

describe('note value formulas', () => {
  it('collects self and external references without exposing parser internals', () => {
    expect(collectFormulaReferences('[[strength]] + [[prof_bonus]]')).toEqual([
      { kind: 'self', slug: 'strength' },
      { kind: 'self', slug: 'prof_bonus' },
    ])

    expect(collectFormulaReferences('[[Characters/Ada.strength]] + max([[level]], 1)')).toEqual([
      { kind: 'external', notePathRaw: 'Characters/Ada', slug: 'strength' },
      { kind: 'self', slug: 'level' },
    ])

    expect(collectFormulaReferences('1 +')).toEqual([])
  })

  it('compiles and evaluates same-note arithmetic and helper functions', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength', '16', 'Strength'),
      authoredValue(
        'note-1',
        'block-2',
        'value-2',
        'strength_mod',
        'floor(([[strength]] - 10) / 2)',
      ),
      authoredValue('note-1', 'block-3', 'value-3', 'attack_bonus', '[[strength_mod]] + 2'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states.find((state) => state.slug === 'strength_mod')?.rawValue).toBe(3)
    expect(states.find((state) => state.slug === 'attack_bonus')?.rawValue).toBe(5)
  })

  it('evaluates canonical numeric literals without stringifying compiled output', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'tiny', '0.0000001'),
    ])

    expect(definitions[0].compiledFormula).toEqual({ kind: 'number', value: 0.0000001 })
    expect(evaluateDefinitions(definitions)[0]).toMatchObject({
      status: 'ok',
      rawValue: 0.0000001,
    })
  })

  it('rejects non-finite numeric literals during compile', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'huge', '1e999'),
    ])

    expect(definitions[0]).toMatchObject({
      compileStatus: 'error',
      compiledFormula: null,
      errorCode: 'parse_error',
    })
  })

  it('supports durable external bindings by note/value id', () => {
    const definitions = compileDefinitions(
      [
        authoredValue('note-1', 'block-1', 'value-1', 'strength_mod', '3', 'Strength Mod'),
        authoredValue(
          'note-1',
          'block-2',
          'value-2',
          'attack_bonus',
          '[[strength_mod]] + [[Characters/Fighter.prof_bonus]]',
          'Attack Bonus',
        ),
      ],
      {
        resolveExternal: (_notePathRaw, slug) => ({
          ok: true,
          noteId: 'note-2',
          valueId: slug === 'prof_bonus' ? 'value-prof' : 'missing',
        }),
      },
    )

    const states = evaluateDefinitions(definitions, (noteId, valueId) => {
      if (noteId !== 'note-2' || valueId !== 'value-prof') {
        return null
      }

      return {
        noteId,
        blockNoteId: 'block-prof',
        valueId,
        slug: 'prof_bonus',
        status: 'ok',
        rawValue: 2,
        formattedValue: '2',
        errorCode: null,
        errorMessage: null,
      }
    })

    expect(states.find((state) => state.slug === 'attack_bonus')?.rawValue).toBe(5)
  })

  it('splits external value references on the last dot inside the brackets', () => {
    const seen: Array<{ notePathRaw: string; slug: string }> = []
    const definitions = compileDefinitions(
      [
        authoredValue(
          'note-1',
          'block-1',
          'value-1',
          'total',
          '[[Source.V1.prof_bonus]] + 1',
          'Total',
        ),
      ],
      {
        resolveExternal: (notePathRaw, slug) => {
          seen.push({ notePathRaw, slug })
          return { ok: true, noteId: 'note-2', valueId: 'value-prof' }
        },
      },
    )

    expect(definitions[0]).toMatchObject({ compileStatus: 'ok' })
    expect(seen).toEqual([{ notePathRaw: 'Source.V1', slug: 'prof_bonus' }])
  })

  it('surfaces cyclic dependencies as errors', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'a', '[[b]]'),
      authoredValue('note-1', 'block-2', 'value-2', 'b', '[[a]]'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states.every((state) => state.status === 'error')).toBe(true)
    expect(states.some((state) => state.errorCode === 'cyclic_dependency')).toBe(true)
  })

  it('surfaces direct self references as cyclic dependency errors', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'attack_bonus', '[[attack_bonus]]'),
    ])

    expect(evaluateDefinitions(definitions)[0]).toMatchObject({
      status: 'error',
      errorCode: 'cyclic_dependency',
      errorMessage: 'Cyclic dependency detected',
    })
  })

  it('surfaces duplicate value ids for every duplicated block state', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength', '16', 'Strength'),
      authoredValue('note-1', 'block-2', 'value-1', 'strength_copy', '18', 'Strength Copy'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states).toHaveLength(2)
    expect(states.every((state) => state.status === 'error')).toBe(true)
    expect(states.every((state) => state.errorCode === 'duplicate_value_id')).toBe(true)
    expect(states.map((state) => state.blockNoteId)).toEqual(['block-1', 'block-2'])
  })

  it('surfaces same-block duplicate value ids for each definition', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength', '16'),
      authoredValue('note-1', 'block-1', 'value-1', 'strength_copy', '18'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states).toHaveLength(2)
    expect(states.every((state) => state.errorCode === 'duplicate_value_id')).toBe(true)
    expect(states.map((state) => state.slug)).toEqual(['strength', 'strength_copy'])
  })

  it('compiles same-note references from bracketed value syntax', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength_mod', '3'),
      authoredValue('note-1', 'block-2', 'value-2', 'attack_bonus', '[[strength_mod]] + 2'),
    ])

    expect(
      evaluateDefinitions(definitions).find((state) => state.slug === 'attack_bonus'),
    ).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })
  })

  it('supports forward references within a note', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'attack_bonus', '[[strength_mod]] + 2'),
      authoredValue('note-1', 'block-2', 'value-2', 'strength_mod', '3'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states.find((state) => state.slug === 'attack_bonus')).toMatchObject({
      status: 'ok',
      rawValue: 5,
    })
  })

  it('returns explicit empty-expression errors', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength_mod', '   '),
    ])

    expect(definitions[0]).toMatchObject({
      compileStatus: 'error',
      errorCode: 'empty_expression',
      errorMessage: 'Enter a literal value or formula',
    })
  })

  it('returns parse errors for malformed syntax', () => {
    const malformed = [
      authoredValue('note-1', 'block-1', 'value-1', 'broken_a', '1 +'),
      authoredValue('note-1', 'block-2', 'value-2', 'broken_b', 'floor((1 + 2)'),
      authoredValue('note-1', 'block-3', 'value-3', 'broken_c', '1 $ 2'),
      authoredValue('note-1', 'block-4', 'value-4', 'broken_d', '[[Bad Note].slug'),
    ]

    const definitions = compileDefinitions(malformed)
    expect(definitions).toHaveLength(4)
    expect(definitions.every((definition) => definition.compileStatus === 'error')).toBe(true)
    expect(definitions.every((definition) => definition.errorCode === 'parse_error')).toBe(true)
  })

  it('returns invalid function usage for bad arity and unknown functions', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'bad_floor', 'floor(1, 2)'),
      authoredValue('note-1', 'block-2', 'value-2', 'bad_round', 'round()'),
      authoredValue('note-1', 'block-3', 'value-3', 'bad_min', 'min()'),
      authoredValue('note-1', 'block-4', 'value-4', 'bad_unknown', 'pow(2, 3)'),
    ])

    expect(definitions).toHaveLength(4)
    expect(definitions.every((definition) => definition.compileStatus === 'error')).toBe(true)
    expect(definitions.every((definition) => definition.compiledFormula === null)).toBe(true)
    expect(
      definitions.every((definition) => definition.errorCode === 'invalid_function_usage'),
    ).toBe(true)

    const states = evaluateDefinitions(definitions)
    expect(states).toHaveLength(4)
    expect(states.every((state) => state.status === 'error')).toBe(true)
    expect(states.every((state) => state.errorCode === 'invalid_function_usage')).toBe(true)
  })

  it('fails invalid formula functions during compile', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'unknown_function', 'foo(1)'),
      authoredValue('note-1', 'block-2', 'value-2', 'too_many_args', 'round(1, 2)'),
      authoredValue('note-1', 'block-3', 'value-3', 'too_few_args', 'min()'),
    ])

    expect(definitions).toHaveLength(3)
    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'unknown_function',
          compileStatus: 'error',
          compiledFormula: null,
          errorCode: 'invalid_function_usage',
          errorMessage: 'Unknown function "foo"',
        }),
        expect.objectContaining({
          slug: 'too_many_args',
          compileStatus: 'error',
          compiledFormula: null,
          errorCode: 'invalid_function_usage',
          errorMessage: 'round expects exactly 1 argument',
        }),
        expect.objectContaining({
          slug: 'too_few_args',
          compileStatus: 'error',
          compiledFormula: null,
          errorCode: 'invalid_function_usage',
          errorMessage: 'min expects at least 1 argument',
        }),
      ]),
    )
  })

  it('distinguishes unknown same-note and unknown external references at compile time', () => {
    const definitions = compileDefinitions(
      [
        authoredValue('note-1', 'block-1', 'value-1', 'local_missing', '[[missing_local]] + 1'),
        authoredValue(
          'note-1',
          'block-2',
          'value-2',
          'external_missing',
          '[[Missing Note.prof_bonus]] + 1',
        ),
      ],
      {
        resolveExternal: () => ({
          ok: false,
          errorCode: 'unknown_reference',
          errorMessage: 'Unknown note reference "[[Missing Note]]"',
        }),
      },
    )

    expect(definitions[0]).toMatchObject({
      compileStatus: 'error',
      errorCode: 'unknown_reference',
      errorMessage: 'Unknown reference "[[missing_local]]"',
    })
    expect(definitions[1]).toMatchObject({
      compileStatus: 'error',
      errorCode: 'unknown_reference',
      errorMessage: 'Unknown note reference "[[Missing Note]]"',
    })
  })

  it('returns a clear error when an external reference has no value slug after the dot', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'broken', '[[Source Note.]]'),
    ])

    expect(definitions[0]).toMatchObject({
      compileStatus: 'error',
      errorCode: 'parse_error',
      errorMessage: 'Expected a value slug after "." in "[[Source Note.]]"',
    })
  })

  it('returns invalid slug errors for malformed slugs', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'Bad Slug', '1'),
      authoredValue('note-1', 'block-2', 'value-2', '_bad-slug', '1'),
    ])

    expect(definitions).toHaveLength(2)
    expect(definitions.every((definition) => definition.compileStatus === 'error')).toBe(true)
    expect(definitions.every((definition) => definition.errorCode === 'invalid_slug')).toBe(true)
  })

  it('allows hyphenated value slugs', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'attack-bonus', '1'),
      authoredValue('note-1', 'block-2', 'value-2', 'total', '[[attack-bonus]] + 1'),
    ])

    expect(definitions.map((definition) => definition.compileStatus)).toEqual(['ok', 'ok'])
  })

  it('allows value slugs that match function names', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'min', '1'),
      authoredValue('note-1', 'block-2', 'value-2', 'total', '[[min]] + min(2, 3)'),
    ])

    expect(definitions.map((definition) => definition.compileStatus)).toEqual(['ok', 'ok'])
  })

  it('returns duplicate slug errors for all blocks sharing the same slug', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'strength_mod', '3'),
      authoredValue('note-1', 'block-2', 'value-2', 'strength_mod', '4'),
    ])

    expect(definitions).toHaveLength(2)
    expect(definitions.every((definition) => definition.compileStatus === 'error')).toBe(true)
    expect(definitions.every((definition) => definition.errorCode === 'duplicate_slug')).toBe(true)
  })

  it('returns explicit missing target runtime errors for unresolved compiled bindings', () => {
    const states = evaluateDefinitions([
      {
        ...authoredValue('note-1', 'block-1', 'value-1', 'attack_bonus', '[[strength_mod]] + 2'),
        compiledFormula: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'binding', key: 'ref_0' },
          right: { kind: 'number', value: 2 },
        },
        bindings: [{ key: 'ref_0', targetNoteId: 'note-2', targetValueId: 'value-missing' }],
        compileStatus: 'ok',
        errorCode: null,
        errorMessage: null,
      },
    ])

    expect(states[0]).toMatchObject({
      status: 'error',
      rawValue: null,
      errorCode: 'missing_target',
      errorMessage: 'Referenced value could not be found',
    })
  })

  it('propagates dependency errors from invalid dependencies', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'broken', '1 / 0'),
      authoredValue('note-1', 'block-2', 'value-2', 'dependent', '[[broken]] + 1'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states.find((state) => state.slug === 'broken')).toMatchObject({
      status: 'error',
      errorCode: 'division_by_zero',
    })
    expect(states.find((state) => state.slug === 'dependent')).toMatchObject({
      status: 'error',
      errorCode: 'dependency_error',
    })
  })

  it('returns division-by-zero errors for invalid arithmetic', () => {
    const definitions = compileDefinitions([
      authoredValue('note-1', 'block-1', 'value-1', 'broken', '1 / 0'),
    ])

    const states = evaluateDefinitions(definitions)
    expect(states[0]).toMatchObject({
      status: 'error',
      rawValue: null,
      errorCode: 'division_by_zero',
      errorMessage: 'Division by zero',
    })
  })

  it('returns non-finite-result errors when dependencies produce infinity', () => {
    const states = evaluateDefinitions(
      [
        {
          ...authoredValue('note-1', 'block-1', 'value-1', 'derived', '[[source]]'),
          compiledFormula: { kind: 'binding', key: 'ref_0' },
          bindings: [{ key: 'ref_0', targetNoteId: 'note-2', targetValueId: 'value-source' }],
          compileStatus: 'ok',
          errorCode: null,
          errorMessage: null,
        },
      ],
      (noteId, valueId) => ({
        noteId,
        blockNoteId: 'block-source',
        valueId,
        slug: 'source',
        status: 'ok',
        rawValue: Number.POSITIVE_INFINITY,
        formattedValue: 'Infinity',
        errorCode: null,
        errorMessage: null,
      }),
    )

    expect(states[0]).toMatchObject({
      status: 'error',
      rawValue: null,
      errorCode: 'non_finite_result',
      errorMessage: 'Result is not a finite number',
    })
  })

  it('formats values with implicit integer-or-two-decimal precision', () => {
    const format = formatNoteValue as (value: number) => string
    expect(format(3)).toBe('3')
    expect(format(3.5)).toBe('3.50')
    expect(format(3.456)).toBe('3.46')
    expect(format(3.004)).toBe('3')
  })
})
