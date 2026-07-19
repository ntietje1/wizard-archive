declare const contentGenerationBrand: unique symbol

export type ContentGeneration = number & { readonly [contentGenerationBrand]: true }

export const INITIAL_CONTENT_GENERATION = 1 as ContentGeneration

export function assertContentGeneration(value: unknown): ContentGeneration {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 1) {
    throw new TypeError('Invalid content generation')
  }
  return value as ContentGeneration
}

export function advanceContentGeneration(current: ContentGeneration): ContentGeneration {
  if (current === Number.MAX_SAFE_INTEGER) throw new RangeError('generation_exhausted')
  return (current + 1) as ContentGeneration
}
