import { zodToConvex } from 'convex-helpers/server/zod4'
import { z } from 'zod'

export const CANONICAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const DEFAULT_CANONICAL_SLUG_MAX_LENGTH = 255
export const MAX_UNIQUE_SLUG_ATTEMPTS = 100

export type BrandedString<Kind extends string> = string & { readonly __brand: Kind }

type CanonicalSlugSchemaOptions = {
  label: string
  minLength?: number
  maxLength: number
}

type CanonicalSlugHelpersOptions<Kind extends string> = CanonicalSlugSchemaOptions & {
  brand: Kind
  fallbackMessage: string
}

function brandString<Kind extends string>(value: string): BrandedString<Kind> {
  return value as BrandedString<Kind>
}

function getFirstIssueMessage<T>(result: z.ZodSafeParseResult<T>, fallback: string): string {
  if (result.success) {
    return fallback
  }

  return result.error.issues[0]?.message ?? fallback
}

function buildCanonicalSlugSchema({ label, minLength, maxLength }: CanonicalSlugSchemaOptions) {
  return z
    .string()
    .refine((value) => value.trim().length > 0, `${label} is required`)
    .refine((value) => value === value.trim(), `${label} cannot start or end with whitespace`)
    .regex(
      CANONICAL_SLUG_PATTERN,
      `${label} can only contain lowercase letters, numbers, and single hyphens`,
    )
    .refine(
      (value) => minLength === undefined || value.length >= minLength,
      minLength === undefined ? '' : `${label} must be at least ${minLength} characters`,
    )
    .refine(
      (value) => value.length <= maxLength,
      `${label} must be at most ${maxLength} characters`,
    )
}

export function createCanonicalSlugHelpers<Kind extends string>({
  brand,
  fallbackMessage,
  ...schemaOptions
}: CanonicalSlugHelpersOptions<Kind>) {
  const valueSchema = buildCanonicalSlugSchema(schemaOptions)
  const schema = valueSchema.transform((value) => brandString<Kind>(value))
  const validator = zodToConvex(valueSchema)

  const validate = (value: string): string | null => {
    const result = valueSchema.safeParse(value)
    return result.success ? null : getFirstIssueMessage(result, fallbackMessage)
  }

  const parse = (value: string): BrandedString<Kind> | null => {
    const result = valueSchema.safeParse(value)
    return result.success ? brandString<Kind>(result.data) : null
  }

  const assert = (value: string): BrandedString<Kind> => {
    const result = valueSchema.safeParse(value)
    if (!result.success) {
      throw new Error(getFirstIssueMessage(result, fallbackMessage))
    }
    return brandString<Kind>(result.data)
  }

  return {
    brand,
    valueSchema,
    schema,
    validator,
    validate,
    parse,
    assert,
  }
}

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  const withHyphens = lower.replace(/[\s_]+/g, '-')
  const cleaned = withHyphens.replace(/[^a-z0-9-]/g, '')
  const collapsed = cleaned.replace(/-+/g, '-')
  return collapsed.replace(/^-+/, '').replace(/-+$/, '')
}

export function appendSuffix(base: string, suffixNumber: number, maxLength: number): string {
  if (suffixNumber <= 1) {
    return base.slice(0, maxLength).replace(/-+$/, '')
  }

  const suffix = `-${suffixNumber}`
  if (suffix.length >= maxLength) {
    throw new Error(
      `Cannot append suffix ${suffixNumber}: suffix length ${suffix.length} exceeds max length ${maxLength}`,
    )
  }
  const truncatedBase = base.slice(0, Math.max(0, maxLength - suffix.length)).replace(/-+$/, '')
  return `${truncatedBase}${suffix}`
}

export async function findUniqueSlug(
  name: string,
  checkFn: (slug: string) => Promise<boolean>,
  {
    maxLength = DEFAULT_CANONICAL_SLUG_MAX_LENGTH,
    isValidCandidate,
  }: {
    maxLength?: number
    isValidCandidate?: (slug: string) => boolean
  } = {},
): Promise<string> {
  const normalized = slugify(name)
  if (!normalized) {
    throw new Error(`Cannot generate slug: input normalized to empty for "${name}"`)
  }

  for (let suffix = 1; suffix <= MAX_UNIQUE_SLUG_ATTEMPTS; suffix++) {
    const candidate = appendSuffix(normalized, suffix, maxLength)
    if (isValidCandidate && !isValidCandidate(candidate)) {
      continue
    }
    const conflict = await checkFn(candidate)
    if (!conflict) {
      return candidate
    }
  }

  throw new Error(`Failed to find unique slug for: ${name}`)
}
