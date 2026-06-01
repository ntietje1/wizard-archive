import { v } from 'convex/values'
import { brandString } from '../../shared/branded'
import { parseSlug as parseSharedSlug, validateSlug } from '../../shared/slugs'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { BrandedString } from '../../shared/branded'
import type { SlugOptions } from '../../shared/slugs'

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
