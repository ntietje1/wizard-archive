import { ConvexError } from 'convex/values'

// Error code enum — single source of truth
export const ERROR_CODE = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

// Structured error data shape used with ConvexError
export type AppErrorData = {
  code: ErrorCode
  message: string
}

// Server-side: throw a structured ConvexError
export function throwAppError(code: ErrorCode, message: string): never {
  throw new ConvexError<AppErrorData>({ code, message })
}

// Client-side: detect a structured error by code
export function isAppError(error: unknown, code: ErrorCode): boolean {
  // Direct ConvexError instance
  if (
    error instanceof ConvexError &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'code' in error.data &&
    error.data.code === code
  )
    return true
  // Convex WebSocket errors wrap the message as a string
  if (error instanceof Error && error.message.includes(code)) return true
  return false
}
