import { toast } from 'sonner'
import { getClientErrorMessage } from 'convex/errors'

type LogFn = (...args: Array<unknown>) => void

const noop: LogFn = () => {}

function createLogger() {
  const isDev = import.meta.env.DEV
  return {
    log: isDev ? console.log.bind(console) : noop,
    warn: isDev ? console.warn.bind(console) : noop,
    error: console.error.bind(console),
    debug: isDev ? console.debug.bind(console) : noop,
  }
}

export const logger = createLogger()

export function handleError(error: unknown, fallbackMessage?: string): void {
  const clientMessage = getClientErrorMessage(error)
  toast.error(clientMessage ?? fallbackMessage ?? 'Something went wrong')
  logger.error(error)
}
