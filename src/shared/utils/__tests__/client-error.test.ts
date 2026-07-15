import { describe, expect, it } from 'vite-plus/test'
import { ConvexError } from 'convex/values'
import { ERROR_CODE, getClientErrorMessage, isClientError } from 'shared/errors/client'

describe('client error contract', () => {
  it('recognizes structured Convex client errors', () => {
    const error = new ConvexError({
      kind: 'client',
      code: ERROR_CODE.NOT_AUTHENTICATED,
      message: 'Not authenticated',
    })

    expect(isClientError(error)).toBe(true)
    expect(isClientError(error, ERROR_CODE.NOT_AUTHENTICATED)).toBe(true)
    expect(isClientError(error, ERROR_CODE.PERMISSION_DENIED)).toBe(false)
    expect(getClientErrorMessage(error)).toBe('Not authenticated')
  })

  it('recognizes serialized websocket client errors', () => {
    const error = new Error(
      'Server Error: {"kind":"client","code":"VALIDATION_FAILED","message":"Invalid name"}',
    )

    expect(isClientError(error, ERROR_CODE.VALIDATION_FAILED)).toBe(true)
    expect(getClientErrorMessage(error)).toBe('Invalid name')
  })

  it('ignores malformed client error payloads', () => {
    expect(
      isClientError(new Error('Server Error: {"kind":"client","message":"Missing code"}')),
    ).toBe(false)
    expect(getClientErrorMessage(new Error('plain error'))).toBe(null)
  })
})
