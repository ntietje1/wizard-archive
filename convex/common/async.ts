export type MaybePromise<T> = T | Promise<T>

export function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}
