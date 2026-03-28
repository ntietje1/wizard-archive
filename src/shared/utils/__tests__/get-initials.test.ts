import { describe, expect, it } from 'vitest'
import { getInitials } from '~/shared/utils/get-initials'

describe('getInitials', () => {
  it('returns two initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns single initial for single word name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('caps at two initials for long names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })

  it('falls back to email initial when name is empty', () => {
    expect(getInitials('', 'jane@example.com')).toBe('J')
  })

  it('falls back to email initial when name is null', () => {
    expect(getInitials(null, 'bob@example.com')).toBe('B')
  })

  it('returns U when both are empty', () => {
    expect(getInitials('', '')).toBe('U')
    expect(getInitials(null, null)).toBe('U')
    expect(getInitials()).toBe('U')
  })

  it('handles whitespace-only name', () => {
    expect(getInitials('   ', 'test@example.com')).toBe('T')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('handles multiple spaces between words', () => {
    expect(getInitials('John   Doe')).toBe('JD')
  })
})
