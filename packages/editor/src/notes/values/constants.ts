import type { SlugOptions } from '../../../../../shared/slugs'

interface NoteValueFunctionMetadata {
  name: string
  signature: string
  snippet: string
  description: string
  minArgs: number
  maxArgs?: number
}

export const NOTE_VALUE_FUNCTIONS = [
  {
    name: 'min',
    signature: 'min(value, ...values)',
    snippet: 'min()',
    description: 'Returns the smallest value.',
    minArgs: 1,
  },
  {
    name: 'max',
    signature: 'max(value, ...values)',
    snippet: 'max()',
    description: 'Returns the largest value.',
    minArgs: 1,
  },
  {
    name: 'round',
    signature: 'round(value)',
    snippet: 'round()',
    description: 'Rounds to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'floor',
    signature: 'floor(value)',
    snippet: 'floor()',
    description: 'Rounds down to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'ceil',
    signature: 'ceil(value)',
    snippet: 'ceil()',
    description: 'Rounds up to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'abs',
    signature: 'abs(value)',
    snippet: 'abs()',
    description: 'Returns the absolute value.',
    minArgs: 1,
    maxArgs: 1,
  },
] as const satisfies ReadonlyArray<NoteValueFunctionMetadata>

export const NOTE_VALUE_FUNCTION_BY_NAME: ReadonlyMap<string, NoteValueFunctionMetadata> = new Map(
  NOTE_VALUE_FUNCTIONS.map((fn) => [fn.name, fn]),
)

export const NOTE_VALUE_DEFAULT_SLUG = 'value'
const NOTE_VALUE_SLUG_MAX_LENGTH = 255
export const NOTE_VALUE_SLUG_OPTIONS = {
  label: 'Value slug',
  maxLength: NOTE_VALUE_SLUG_MAX_LENGTH,
} as const satisfies SlugOptions

export function formatNoteValue(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  if (Object.is(rounded, -0)) {
    return '0'
  }
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2)
}
