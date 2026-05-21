import { describe, expect, it } from 'vite-plus/test'
import { parseCampaignSlug, validateCampaignSlug } from '../../campaigns/validation'
import { parseSidebarItemSlug, validateSidebarItemSlug } from '../../sidebarItems/validation/slug'
import { parseUsername, validateUsername } from '../../users/validation'

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
    expect(parseSidebarItemSlug('7_lore')).toBe('7_lore')
    expect(parseSidebarItemSlug('lore-index')).toBe('lore-index')
    expect(validateSidebarItemSlug('lore_index')).toBeNull()
    for (const slug of consecutiveSeparatorSlugs) {
      expect(validateSidebarItemSlug(slug)).toContain('consecutive separators')
    }
  })

  it('keeps only username minimum slug length', () => {
    expect(validateUsername('abc')).toContain('at least 4')
    expect(validateUsername('abcd')).toBeNull()
    expect(validateCampaignSlug('a')).toBeNull()
    expect(validateSidebarItemSlug('a')).toBeNull()
  })

  it('keeps domain max lengths', () => {
    expect(validateUsername('a'.repeat(31))).toContain('at most 30')
    expect(validateCampaignSlug('a'.repeat(31))).toContain('at most 30')
    expect(validateSidebarItemSlug('a'.repeat(256))).toContain('at most 255')
  })
})
