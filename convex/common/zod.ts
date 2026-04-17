import type { z } from 'zod'
import { ERROR_CODE, throwClientError } from '../errors'

export function parseOrThrowClientValidation<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      result.error.issues[0]?.message ?? fallbackMessage,
    )
  }

  return result.data
}
