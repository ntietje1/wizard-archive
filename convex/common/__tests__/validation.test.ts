import { describe, expect, it } from 'vite-plus/test'
import { parseUsername, validateUsername } from '../../../shared/users/validation'

const consecutiveSeparatorUsernames = ['name--link', 'name-_link', 'name_-link', 'name__link']

describe('username parsing', () => {
  it('uses the username product syntax', () => {
    expect(parseUsername('7_player')).toBe('7_player')
    expect(validateUsername('alice')).toBeNull()
    expect(validateUsername('alice_1')).toBeNull()
    expect(parseUsername('Invalid User')).toBeNull()
    for (const username of consecutiveSeparatorUsernames) {
      expect(validateUsername(username)).toContain('consecutive separators')
    }
  })

  it('enforces the username minimum length', () => {
    expect(validateUsername('abc')).toContain('at least 4')
    expect(validateUsername('abcd')).toBeNull()
  })

  it('enforces the username maximum length', () => {
    expect(validateUsername('a'.repeat(31))).toContain('at most 30')
  })
})
