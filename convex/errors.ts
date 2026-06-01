import { ConvexError } from 'convex/values'
import type { ClientErrorCode, ClientErrorData } from '../shared/errors/client'

export function throwClientError(code: ClientErrorCode, message: string): never {
  throw new ConvexError<ClientErrorData>({ kind: 'client', code, message })
}
