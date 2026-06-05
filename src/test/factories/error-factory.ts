import type { ClientErrorCode, ClientErrorData } from 'shared/errors/client'

export function clientError(code: ClientErrorCode): Error & { data: ClientErrorData } {
  return Object.assign(new Error('Campaign not found'), {
    data: {
      kind: 'client',
      code,
      message: 'Campaign not found',
    },
  } satisfies { data: ClientErrorData })
}
