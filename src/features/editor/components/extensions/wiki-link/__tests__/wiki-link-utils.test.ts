import { describe, expect, it } from 'vite-plus/test'
import { splitWikiLinkTargetAndDisplayName } from '../wiki-link-utils'

describe('splitWikiLinkTargetAndDisplayName', () => {
  it('returns the full query when no display name is present', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City#District')).toEqual({
      targetQuery: 'World/City#District',
      displayName: null,
    })
  })

  it('returns an empty target and null display name for empty input', () => {
    expect(splitWikiLinkTargetAndDisplayName('')).toEqual({
      targetQuery: '',
      displayName: null,
    })
  })

  it('separates a display name from the target query', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City#District|Capital')).toEqual({
      targetQuery: 'World/City#District',
      displayName: 'Capital',
    })
  })

  it('treats the last pipe as the display name separator', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City|Capital|Alias')).toEqual({
      targetQuery: 'World/City|Capital',
      displayName: 'Alias',
    })
  })

  it('preserves an empty display name after a trailing pipe', () => {
    expect(splitWikiLinkTargetAndDisplayName('Target|')).toEqual({
      targetQuery: 'Target',
      displayName: '',
    })
  })

  it('allows an empty target before the display name', () => {
    expect(splitWikiLinkTargetAndDisplayName('|DisplayOnly')).toEqual({
      targetQuery: '',
      displayName: 'DisplayOnly',
    })
  })
})
