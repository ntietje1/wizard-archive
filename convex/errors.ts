import { ConvexError } from 'convex/values'

const CLIENT_ERROR_CODE = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT: 'CONFLICT',
} as const

const SERVER_ERROR_CODE = {
  INTERNAL: 'INTERNAL',
} as const

export const ERROR_CODE = {
  ...CLIENT_ERROR_CODE,
  ...SERVER_ERROR_CODE,
} as const

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODE)[keyof typeof CLIENT_ERROR_CODE]

export type ServerErrorCode =
  (typeof SERVER_ERROR_CODE)[keyof typeof SERVER_ERROR_CODE]

export type ClientErrorData = {
  kind: 'client'
  code: ClientErrorCode
  message: string
}

export type ServerErrorData = {
  kind: 'server'
  code: ServerErrorCode
  message: string
}

type AppErrorData = ClientErrorData | ServerErrorData

type AppConvexError = ConvexError<AppErrorData> & { data: AppErrorData }

export function throwClientError(
  code: ClientErrorCode,
  message: string,
): never {
  throw new ConvexError<ClientErrorData>({ kind: 'client', code, message })
}

export function throwServerError(message: string): never {
  throw new ConvexError<ServerErrorData>({
    kind: 'server',
    code: 'INTERNAL',
    message,
  })
}

function isConvexErrorData(data: unknown): data is AppErrorData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    'code' in data &&
    'message' in data &&
    (data.kind === 'client' || data.kind === 'server')
  )
}

function parseWebSocketError(error: Error): AppErrorData | null {
  const match = error.message.match(
    /\{"kind":"(client|server)","code":"(\w+)","message":"([^"]+)"\}/,
  )
  if (!match) return null
  const [, kind, code, message] = match
  return { kind, code, message } as AppErrorData
}

function toAppError(error: unknown): AppConvexError | null {
  if (error instanceof ConvexError && isConvexErrorData(error.data)) {
    return error as AppConvexError
  }
  if (error instanceof Error) {
    const parsed = parseWebSocketError(error)
    if (parsed) return { data: parsed } as AppConvexError
  }
  return null
}

export function isClientError(
  error: unknown,
): error is AppConvexError & { data: ClientErrorData }
export function isClientError(
  error: unknown,
  code: ClientErrorCode,
): error is AppConvexError & { data: ClientErrorData & { code: typeof code } }
export function isClientError(
  error: unknown,
  code?: ClientErrorCode,
): error is AppConvexError & { data: ClientErrorData } {
  const appError = toAppError(error)
  if (!appError || appError.data.kind !== 'client') return false
  return code === undefined || appError.data.code === code
}

export function getClientErrorMessage(error: unknown): string | null {
  const appError = toAppError(error)
  if (!appError || appError.data.kind !== 'client') return null
  return appError.data.message
}
