import { describe, expect, it } from 'vitest'
import { parseCampaignSlug, validateCampaignSlug } from '../../campaigns/validation'
import { parseSidebarItemSlug, validateSidebarItemSlug } from '../../sidebarItems/validation/slug'
import { parseUsername, validateUsername } from '../../users/validation'
import { appendSuffix, findUniqueSlug, slugify } from '../slug'

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
    expect(validateUsername('alice')).toBeNull()
  })

  it('returns error when too short', () => {
    expect(validateUsername('a')).toContain('at least 2')
  })

  it('returns error when too long', () => {
    const long = 'a'.repeat(31)
    expect(validateUsername(long)).toContain('at most 30')
  })

  it('returns error for uppercase letters', () => {
    expect(validateUsername('Alice')).toContain('cannot contain uppercase letters')
  })

  it('returns error for special characters', () => {
    expect(validateUsername('alice!')).toContain('cannot contain special characters')
  })

  it('returns null at exact min length', () => {
    expect(validateUsername('ab')).toBeNull()
  })

  it('returns null at exact max length', () => {
    const exact = 'a'.repeat(30)
    expect(validateUsername(exact)).toBeNull()
  })
})

describe('appendSuffix', () => {
  it('returns base unchanged for n <= 1', () => {
    expect(appendSuffix('hello', 1, 10)).toBe('hello')
    expect(appendSuffix('hello', 0, 10)).toBe('hello')
  })

  it('returns base-n for n > 1', () => {
    expect(appendSuffix('hello', 2, 10)).toBe('hello-2')
    expect(appendSuffix('hello', 10, 10)).toBe('hello-10')
  })

  it('truncates the base before applying a suffix when needed', () => {
    expect(appendSuffix('hello-world', 12, 10)).toBe('hello-w-12')
  })

  it('throws when the suffix cannot fit within the max length', () => {
    expect(() => appendSuffix('hello', 10, 3)).toThrow('Cannot append suffix 10')
  })
})

describe('findUniqueSlug', () => {
  it('returns base slug when no conflict', async () => {
    const slug = await findUniqueSlug('Hello World', () => Promise.resolve(false))
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
    await expect(findUniqueSlug('hello', () => Promise.resolve(true))).rejects.toThrow(
      'Failed to find unique slug',
    )
  })

  it('increments suffix until unique slug found', async () => {
    let calls = 0
    const slug = await findUniqueSlug('hello', () => {
      calls++
      return Promise.resolve(calls <= 3)
    })
    expect(slug).toBe('hello-4')
  })

  it('truncates long slugs before trying uniqueness suffixes', async () => {
    const slug = await findUniqueSlug(
      'A Very Long Sidebar Item Name',
      (candidate) => Promise.resolve(candidate === 'a-very-long'),
      {
        maxLength: 12,
      },
    )
    expect(slug).toBe('a-very-lon-2')
  })

  it('fails fast when the input normalizes to an empty slug', async () => {
    await expect(findUniqueSlug('🎉🎊', () => Promise.resolve(false))).rejects.toThrow(
      'Cannot generate slug: input normalized to empty',
    )
  })
})

describe('entity-specific slug parsing', () => {
  it('parses valid usernames', () => {
    expect(parseUsername('valid-user')).toBe('valid-user')
  })

  it('rejects invalid usernames', () => {
    expect(parseUsername('Invalid User')).toBeNull()
  })

  it('parses usernames at the exact length boundaries', () => {
    expect(parseUsername('ab')).toBe('ab')
    expect(parseUsername('a'.repeat(30))).toBe('a'.repeat(30))
  })

  it('rejects usernames with invalid characters or length', () => {
    expect(parseUsername('user_name')).toBeNull()
    expect(parseUsername('a')).toBeNull()
    expect(parseUsername('a'.repeat(31))).toBeNull()
  })

  it('parses valid campaign slugs', () => {
    expect(parseCampaignSlug('campaign-link')).toBe('campaign-link')
  })

  it('parses campaign slugs at the exact length boundaries', () => {
    expect(parseCampaignSlug('abc')).toBe('abc')
    expect(parseCampaignSlug('a'.repeat(30))).toBe('a'.repeat(30))
  })

  it('rejects campaign slugs that are too short', () => {
    expect(validateCampaignSlug('ab')).toContain('at least 3')
  })

  it('rejects campaign slugs that are too long', () => {
    expect(validateCampaignSlug('a'.repeat(31))).toContain('at most 30')
  })

  it('rejects campaign slugs with double hyphens', () => {
    expect(parseCampaignSlug('slug--name')).toBeNull()
    expect(validateCampaignSlug('slug--name')).toContain('single hyphens')
  })

  it('rejects campaign slugs with leading or trailing hyphens', () => {
    expect(parseCampaignSlug('-slug')).toBeNull()
    expect(parseCampaignSlug('slug-')).toBeNull()
    expect(validateCampaignSlug('-slug')).toContain('cannot start or end with a hyphen')
    expect(validateCampaignSlug('slug-')).toContain('cannot start or end with a hyphen')
  })

  it('rejects campaign slugs with uppercase letters', () => {
    expect(validateCampaignSlug('Campaign-link')).toContain('cannot contain uppercase letters')
  })

  it('rejects campaign slugs with spaces', () => {
    expect(validateCampaignSlug('campaign link')).toContain('cannot contain spaces')
  })

  it('rejects campaign slugs with underscores', () => {
    expect(validateCampaignSlug('campaign_link')).toContain('cannot contain underscores')
  })

  it('rejects campaign slugs with special characters', () => {
    expect(validateCampaignSlug('campaign!')).toContain('cannot contain special characters')
  })

  it('parses valid sidebar item slugs', () => {
    expect(parseSidebarItemSlug('lore-index')).toBe('lore-index')
  })

  it('parses sidebar item slugs at the exact length boundaries', () => {
    expect(parseSidebarItemSlug('abc')).toBe('abc')
    expect(parseSidebarItemSlug('a'.repeat(255))).toBe('a'.repeat(255))
  })

  it('rejects sidebar item slugs that are too short', () => {
    expect(parseSidebarItemSlug('ab')).toBeNull()
    expect(validateSidebarItemSlug('ab')).toContain('at least 3')
  })

  it('rejects sidebar item slugs that are too long', () => {
    expect(parseSidebarItemSlug('a'.repeat(256))).toBeNull()
    expect(validateSidebarItemSlug('a'.repeat(256))).toContain('at most 255')
  })

  it('rejects sidebar item slugs with uppercase letters', () => {
    expect(parseSidebarItemSlug('Lore-Index')).toBeNull()
    expect(validateSidebarItemSlug('Lore-Index')).toContain('cannot contain uppercase letters')
  })

  it('rejects sidebar item slugs with spaces', () => {
    expect(parseSidebarItemSlug('lore index')).toBeNull()
    expect(validateSidebarItemSlug('lore index')).toContain('cannot contain spaces')
  })

  it('rejects sidebar item slugs with underscores', () => {
    expect(parseSidebarItemSlug('lore_index')).toBeNull()
    expect(validateSidebarItemSlug('lore_index')).toContain('cannot contain underscores')
  })

  it('rejects sidebar item slugs with special characters', () => {
    expect(parseSidebarItemSlug('lore!')).toBeNull()
    expect(validateSidebarItemSlug('lore!')).toContain('cannot contain special characters')
  })

  it('rejects sidebar item slugs with double hyphens', () => {
    expect(parseSidebarItemSlug('lore--index')).toBeNull()
    expect(validateSidebarItemSlug('lore--index')).toContain('single hyphens')
  })

  it('rejects sidebar item slugs with leading or trailing hyphens', () => {
    expect(parseSidebarItemSlug('-lore-index')).toBeNull()
    expect(parseSidebarItemSlug('lore-index-')).toBeNull()
    expect(validateSidebarItemSlug('-lore-index')).toContain('cannot start or end with a hyphen')
    expect(validateSidebarItemSlug('lore-index-')).toContain('cannot start or end with a hyphen')
  })
})
