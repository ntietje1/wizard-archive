type LogFn = (...args: Array<unknown>) => void

const noop: LogFn = () => {}

function createLogger() {
  const siteUrl = process.env.SITE_URL
  const isProd = siteUrl?.startsWith('https://') ?? false
  return {
    log: isProd ? noop : console.log.bind(console),
    warn: isProd ? noop : console.warn.bind(console),
    error: console.error.bind(console),
    debug: isProd ? noop : console.debug.bind(console),
  }
}

export const logger = createLogger()
