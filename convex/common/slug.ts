import { v } from 'convex/values'
import { parseSlug as parseSharedSlug, validateSlug } from '../../shared/slugs'
import { ERROR_CODE, throwClientError } from '../errors'
import type { SlugOptions } from '../../shared/slugs'

export { deduplicateSlug, parseSlug, slugify, validateSlug } from '../../shared/slugs'

export type BrandedString<Kind extends string> = string & { readonly __brand: Kind }

function brandString<Kind extends string>(value: string): BrandedString<Kind> {
  return value as BrandedString<Kind>
}

export function createSlugHelpers<Kind extends string>(slugOptions: SlugOptions) {
  const validator = v.string()

  const validate = (value: string): string | null => validateSlug(value, slugOptions)

  const parse = (value: string): BrandedString<Kind> | null => {
    const parsed = parseSharedSlug(value, slugOptions)
    return parsed === null ? null : brandString<Kind>(parsed)
  }

  const assert = (value: string): BrandedString<Kind> => {
    const error = validateSlug(value, slugOptions)
    if (error) throwClientError(ERROR_CODE.VALIDATION_FAILED, error)
    return brandString<Kind>(value)
  }

  return {
    validator,
    validate,
    parse,
    assert,
  }
}
