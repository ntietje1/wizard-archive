import type { AnyItemWithContent } from '../../items'
import { assertNever } from './assert-never'

export function throwUnhandledResourceItem(
  value: never,
  message: (item: Partial<Pick<AnyItemWithContent, 'id' | 'type'>>) => string,
): never {
  return assertNever(value, message(value as Partial<Pick<AnyItemWithContent, 'id' | 'type'>>))
}
