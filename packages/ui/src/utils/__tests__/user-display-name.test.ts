import { describe, expect, it } from 'vitest'
import { getCampaignMemberDisplayName, getUserDisplayName } from '../user-display-name'

describe('user display names', () => {
  it('prefers the profile name', () => {
    expect(getUserDisplayName({ name: 'Mina', username: 'mina' })).toBe('Mina')
  })

  it('uses a prefixed username when no name is present', () => {
    expect(getUserDisplayName({ name: null, username: 'mina' })).toBe('@mina')
  })

  it('uses the fallback when no profile display fields are present', () => {
    expect(getUserDisplayName({ name: null, username: null }, 'Unknown')).toBe('Unknown')
    expect(getUserDisplayName(undefined, 'Unknown')).toBe('Unknown')
  })

  it('formats campaign members through their user profile', () => {
    expect(
      getCampaignMemberDisplayName({
        userProfile: { name: null, username: 'mina' },
      }),
    ).toBe('@mina')
  })
})
