import { describe, expect, it } from 'vitest'
import {
  appendSuffix,
  findUniqueSlug,
  slugify,
  validateUsername,
} from '../slug'

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('replaces underscores with hyphens', () => {
    expect(slugify('hello_world')).toBe('hello-world')
  })

  it('strips special characters', () => {
    expect(slugify('hello@world!')).toBe('helloworld')
  })

  it('collapses consecutive hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world')
  })

  it('trims leading hyphens', () => {
    expect(slugify('---hello')).toBe('hello')
  })

  it('trims trailing hyphens', () => {
    expect(slugify('hello---')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles unicode-only input returning empty string', () => {
    expect(slugify('日本語')).toBe('')
    expect(slugify('🎉🎊')).toBe('')
  })

  it('preserves numeric characters', () => {
    expect(slugify('hello123')).toBe('hello123')
    expect(slugify('42 things')).toBe('42-things')
  })

  it('handles input that is entirely hyphens', () => {
    expect(slugify('---')).toBe('')
  })

  it('handles mixed spaces and underscores', () => {
    expect(slugify('hello_world test')).toBe('hello-world-test')
  })
})

describe('validateUsername', () => {
  it('returns null for valid username', () => {
    expect(validateUsername('alice', 'alice', 2, 30)).toBeNull()
  })

  it('returns error when too short', () => {
    expect(validateUsername('a', 'a', 2, 30)).toContain('at least 2')
  })

  it('returns error when too long', () => {
    const long = 'a'.repeat(31)
    expect(validateUsername(long, long, 2, 30)).toContain('at most 30')
  })

  it('returns error for invalid characters', () => {
    expect(validateUsername('alice', 'Alice!', 2, 30)).toContain(
      'letters, numbers, and hyphens',
    )
  })

  it('returns null at exact min length', () => {
    expect(validateUsername('ab', 'ab', 2, 30)).toBeNull()
  })

  it('returns null at exact max length', () => {
    const exact = 'a'.repeat(30)
    expect(validateUsername(exact, exact, 2, 30)).toBeNull()
  })

  it('returns error one below min length', () => {
    expect(validateUsername('a', 'a', 2, 30)).not.toBeNull()
  })

  it('returns error one above max length', () => {
    const over = 'a'.repeat(31)
    expect(validateUsername(over, over, 2, 30)).not.toBeNull()
  })
})

describe('appendSuffix', () => {
  it('returns base unchanged for n <= 1', () => {
    expect(appendSuffix('hello', 1)).toBe('hello')
    expect(appendSuffix('hello', 0)).toBe('hello')
  })

  it('returns base-n for n > 1', () => {
    expect(appendSuffix('hello', 2)).toBe('hello-2')
    expect(appendSuffix('hello', 10)).toBe('hello-10')
  })
})

describe('findUniqueSlug', () => {
  it('returns base slug when no conflict', async () => {
    const slug = await findUniqueSlug('Hello World', () =>
      Promise.resolve(false),
    )
    expect(slug).toBe('hello-world')
  })

  it('appends -2 on first conflict', async () => {
    let calls = 0
    const slug = await findUniqueSlug('hello', () => {
      calls++
      return Promise.resolve(calls === 1)
    })
    expect(slug).toBe('hello-2')
  })

  it('throws after 100 attempts', async () => {
    await expect(
      findUniqueSlug('hello', () => Promise.resolve(true)),
    ).rejects.toThrow('Failed to find unique slug')
  })

  it('increments suffix until unique slug found', async () => {
    let calls = 0
    const slug = await findUniqueSlug('hello', () => {
      calls++
      return Promise.resolve(calls <= 3)
    })
    expect(slug).toBe('hello-4')
  })
})
