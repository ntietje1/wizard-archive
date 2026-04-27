type PrimitiveArrayValue = string | number | boolean | bigint | symbol | null | undefined

export function areArraysEqual<T extends PrimitiveArrayValue>(
  left: ReadonlyArray<T>,
  right: ReadonlyArray<T>,
): boolean {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}
