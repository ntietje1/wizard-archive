export const canvasDevLogger = {
  debug: (...args: Array<unknown>) => {
    if (import.meta.env.DEV) console.debug(...args)
  },
  error: (...args: Array<unknown>) => {
    if (import.meta.env.DEV) console.error(...args)
  },
  warn: (...args: Array<unknown>) => {
    if (import.meta.env.DEV) console.warn(...args)
  },
}
