import { ConvexError } from 'convex/values'

export const ERROR_CODE = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT: 'CONFLICT',
} as const

export type ClientErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

export type ClientErrorData = {
  kind: 'client'
  code: ClientErrorCode
  message: string
}

type ClientConvexError = ConvexError<ClientErrorData> & {
  data: ClientErrorData
}

export function throwClientError(
  code: ClientErrorCode,
  message: string,
): never {
  throw new ConvexError<ClientErrorData>({ kind: 'client', code, message })
}

const ERROR_CODE_VALUES = Object.values(ERROR_CODE) as Array<string>

function isClientErrorData(data: unknown): data is ClientErrorData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    'code' in data &&
    'message' in data &&
    data.kind === 'client' &&
    typeof data.code === 'string' &&
    ERROR_CODE_VALUES.includes(data.code)
  )
}

function parseWebSocketError(error: Error): ClientErrorData | null {
  const start = error.message.indexOf('{')
  const end = error.message.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(error.message.slice(start, end + 1))
    return isClientErrorData(parsed) ? parsed : null
  } catch {
    return null
  }
}

function toClientError(error: unknown): ClientConvexError | null {
  if (error instanceof ConvexError && isClientErrorData(error.data)) {
    return error
  }
  if (error instanceof Error) {
    const parsed = parseWebSocketError(error)
    if (parsed) return new ConvexError(parsed)
  }
  return null
}

export function isClientError(error: unknown): error is ClientConvexError
export function isClientError(
  error: unknown,
  code: ClientErrorCode,
): error is ClientConvexError & {
  data: ClientErrorData & { code: typeof code }
}
export function isClientError(
  error: unknown,
  code?: ClientErrorCode,
): error is ClientConvexError {
  const clientError = toClientError(error)
  if (!clientError) return false
  return code === undefined || clientError.data.code === code
}

export function getClientErrorMessage(error: unknown): string | null {
  const clientError = toClientError(error)
  if (!clientError) return null
  return clientError.data.message
}
