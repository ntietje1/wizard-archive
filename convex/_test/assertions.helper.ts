import { expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { isClientError } from '../errors'
import type { ClientErrorCode } from '../errors'

export async function expectClientError(
  promise: Promise<unknown>,
  code: ClientErrorCode,
) {
  try {
    await promise
    expect.fail(
      `Expected ConvexError with code ${code}, but no error was thrown`,
    )
  } catch (error) {
    if (error instanceof ConvexError && isClientError(error, code)) {
      return error
    }
    if (
      error instanceof Error &&
      'data' in error &&
      isClientError(error, code)
    ) {
      return error
    }
    throw error
  }
}

export function expectNotAuthenticated(promise: Promise<unknown>) {
  return expectClientError(promise, 'NOT_AUTHENTICATED')
}

export function expectPermissionDenied(promise: Promise<unknown>) {
  return expectClientError(promise, 'PERMISSION_DENIED')
}

export function expectNotFound(promise: Promise<unknown>) {
  return expectClientError(promise, 'NOT_FOUND')
}

export function expectValidationFailed(promise: Promise<unknown>) {
  return expectClientError(promise, 'VALIDATION_FAILED')
}

export function expectConflict(promise: Promise<unknown>) {
  return expectClientError(promise, 'CONFLICT')
}
