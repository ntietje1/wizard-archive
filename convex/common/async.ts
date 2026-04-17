export type MaybePromise<T> = T | PromiseLike<T>

export function isPromiseLike<T>(value: MaybePromise<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}
