import { v } from 'convex/values'
import {
  assertStoredUsername as assertSharedStoredUsername,
  assertUsername as assertSharedUsername,
} from '../../shared/users/validation'
import { ERROR_CODE, throwClientError } from '../errors'
import type { Username } from '../../shared/users/validation'

export const usernameValidator = v.string()

export function assertUsername(value: string): Username {
  try {
    return assertSharedUsername(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid username',
    )
  }
}

export function assertStoredUsername(value: string): Username {
  try {
    return assertSharedStoredUsername(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid username',
    )
  }
}
