import { describe, expect, it } from 'vitest'
import { parseCampaignSlug, validateCampaignSlug } from '../../../shared/campaigns/validation'
import { parseResourceItemSlug } from '@wizard-archive/editor/resources/items'
import { parseUsername, validateUsername } from '../../../shared/users/validation'

const consecutiveSeparatorSlugs = ['name--link', 'name-_link', 'name_-link', 'name__link']

describe('entity slug parsing', () => {
  it('uses the universal slug syntax for usernames', () => {
    expect(parseUsername('7_player')).toBe('7_player')
    expect(validateUsername('alice')).toBeNull()
    expect(validateUsername('alice_1')).toBeNull()
    expect(parseUsername('Invalid User')).toBeNull()
    for (const slug of consecutiveSeparatorSlugs) {
      expect(validateUsername(slug)).toContain('consecutive separators')
    }
  })

  it('uses the universal slug syntax for campaign links', () => {
    expect(parseCampaignSlug('7_campaign')).toBe('7_campaign')
    expect(parseCampaignSlug('campaign-link')).toBe('campaign-link')
    expect(validateCampaignSlug('campaign_link')).toBeNull()
    for (const slug of consecutiveSeparatorSlugs) {
      expect(validateCampaignSlug(slug)).toContain('consecutive separators')
    }
  })

  it('uses the universal slug syntax for sidebar items', () => {
    expect(parseResourceItemSlug('7_lore')).toBe('7_lore')
    expect(parseResourceItemSlug('lore-index')).toBe('lore-index')
    expect(parseResourceItemSlug('lore_index')).toBe('lore_index')
    for (const slug of consecutiveSeparatorSlugs) {
      expect(parseResourceItemSlug(slug)).toBeNull()
    }
  })

  it('keeps only username minimum slug length', () => {
    expect(validateUsername('abc')).toContain('at least 4')
    expect(validateUsername('abcd')).toBeNull()
    expect(validateCampaignSlug('a')).toBeNull()
    expect(parseResourceItemSlug('a')).toBe('a')
  })

  it('keeps domain max lengths', () => {
    expect(validateUsername('a'.repeat(31))).toContain('at most 30')
    expect(validateCampaignSlug('a'.repeat(31))).toContain('at most 30')
    expect(parseResourceItemSlug('a'.repeat(256))).toBeNull()
  })
})
