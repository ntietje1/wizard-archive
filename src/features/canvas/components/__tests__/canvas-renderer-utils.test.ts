import { describe, expect, it } from 'vitest'
import { areArraysEqual } from '../canvas-renderer-utils'
import type { PrimitiveArrayValue } from '../canvas-renderer-utils'

describe('canvas renderer utils', () => {
  it('compares primitive arrays by value', () => {
    const left: Array<PrimitiveArrayValue> = ['node', 1, true]
    const right: Array<PrimitiveArrayValue> = ['node', 1, true]

    expect(areArraysEqual(left, right)).toBe(true)
    expect(areArraysEqual(left, ['node', 2, true])).toBe(false)
  })
})
