import { describe, expect, it } from 'vite-plus/test'
import { parseResolvableWikiItemPath } from '../../../shared/links/resolution'

describe('parseResolvableWikiItemPath', () => {
  it('accepts item paths without presentation details', () => {
    expect(parseResolvableWikiItemPath('World/Atlas')).toMatchObject({
      pathKind: 'global',
      itemPath: ['World', 'Atlas'],
    })
  })

  it.each(['World/Atlas|Atlas', 'World/Atlas#Intro', ''])(
    'rejects non-resolvable path %j',
    (path) => {
      expect(parseResolvableWikiItemPath(path)).toBeNull()
    },
  )
})
