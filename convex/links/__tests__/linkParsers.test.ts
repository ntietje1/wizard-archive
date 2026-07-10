import { describe, expect, it } from 'vitest'
import {
  MD_LINK_REGEX,
  WIKI_LINK_REGEX,
  isDangerousUrl,
  parseMdLinkTarget,
  parseWikiLinkText,
} from '../../../shared/links/parsing'
import { extractLinksFromText, getLinkQuery } from '../../../shared/links/extraction'

describe('parseWikiLinkText', () => {
  it('parses a simple name', () => {
    const result = parseWikiLinkText('My Note')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: [],
      displayName: null,
    })
  })

  it('parses a path with folders', () => {
    const result = parseWikiLinkText('Factions/The Guild')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: [],
      displayName: null,
    })
  })

  it('parses heading path', () => {
    const result = parseWikiLinkText('My Note#Section#Subsection')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: ['Section', 'Subsection'],
      displayName: null,
    })
  })

  it('parses display name', () => {
    const result = parseWikiLinkText('Factions/The Guild|The Guild')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: [],
      displayName: 'The Guild',
    })
  })

  it('parses path + heading + display name', () => {
    const result = parseWikiLinkText('Factions/The Guild#Leaders|Guild Leaders')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: ['Leaders'],
      displayName: 'Guild Leaders',
    })
  })

  it('handles empty string', () => {
    const result = parseWikiLinkText('')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: null,
    })
  })

  it('trims whitespace from segments', () => {
    const result = parseWikiLinkText(' Factions / The Guild # Leaders ')
    expect(result).toEqual({
      pathKind: 'global',
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: ['Leaders'],
      displayName: null,
    })
  })

  it('parses relative wiki paths', () => {
    const result = parseWikiLinkText('../../World/Atlas#Region|Atlas')
    expect(result).toEqual({
      pathKind: 'relative',
      itemPath: ['..', '..', 'World', 'Atlas'],
      itemName: 'Atlas',
      headingPath: ['Region'],
      displayName: 'Atlas',
    })
  })
})

describe('parseMdLinkTarget', () => {
  it('handles empty string as an internal unresolved target', () => {
    const result = parseMdLinkTarget('')
    expect(result).toEqual({
      target: '',
      isExternal: false,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })

  it('parses internal path', () => {
    const result = parseMdLinkTarget('Factions/The Guild')
    expect(result).toEqual({
      target: 'Factions/The Guild',
      isExternal: false,
      pathKind: 'global',
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: [],
    })
  })

  it('parses internal path with heading', () => {
    const result = parseMdLinkTarget('My Note#Section')
    expect(result).toEqual({
      target: 'My Note#Section',
      isExternal: false,
      pathKind: 'global',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: ['Section'],
    })
  })

  it('parses internal path with multiple heading levels', () => {
    const result = parseMdLinkTarget('My Note#H1#H2')
    expect(result).toEqual({
      target: 'My Note#H1#H2',
      isExternal: false,
      pathKind: 'global',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: ['H1', 'H2'],
    })
  })

  it('parses relative internal paths', () => {
    const result = parseMdLinkTarget('../World/Atlas')
    expect(result).toEqual({
      target: '../World/Atlas',
      isExternal: false,
      pathKind: 'relative',
      itemPath: ['..', 'World', 'Atlas'],
      itemName: 'Atlas',
      headingPath: [],
    })
  })

  it('detects external URLs', () => {
    const result = parseMdLinkTarget('https://example.com')
    expect(result).toEqual({
      target: 'https://example.com',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })

  it('detects http URLs', () => {
    const result = parseMdLinkTarget('http://example.com')
    expect(result.isExternal).toBe(true)
  })

  it('detects mailto URLs', () => {
    const result = parseMdLinkTarget('mailto:someone@example.com')
    expect(result).toEqual({
      target: 'mailto:someone@example.com',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })

  it('detects ftp URLs', () => {
    const result = parseMdLinkTarget('ftp://example.com')
    expect(result).toEqual({
      target: 'ftp://example.com',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })
})

describe('isDangerousUrl', () => {
  it('returns true for dangerous or non-navigable schemes', () => {
    expect(isDangerousUrl('javascript:alert(1)')).toBe(true)
    expect(isDangerousUrl('data:text/html,<script>')).toBe(true)
    expect(isDangerousUrl('vbscript:msgbox(1)')).toBe(true)
    expect(isDangerousUrl('file:///etc/passwd')).toBe(true)
    expect(isDangerousUrl('blob:https://example.com/uuid')).toBe(true)
    expect(isDangerousUrl('about:blank')).toBe(true)
    expect(isDangerousUrl('filesystem:https://example.com/temporary/file')).toBe(true)
  })

  it('returns false for safe external and internal targets', () => {
    expect(isDangerousUrl('https://example.com')).toBe(false)
    expect(isDangerousUrl('//example.com/docs')).toBe(false)
    expect(isDangerousUrl('Lore/Capital')).toBe(false)
  })
})

describe('parseMdLinkTarget safety', () => {
  it('does not treat dangerous or protocol-relative urls as internal paths', () => {
    expect(parseMdLinkTarget('javascript:alert(1)')).toEqual({
      target: 'javascript:alert(1)',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('data:text/html,<script>')).toEqual({
      target: 'data:text/html,<script>',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('file:///etc/passwd')).toEqual({
      target: 'file:///etc/passwd',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('blob:https://example.com/uuid')).toEqual({
      target: 'blob:https://example.com/uuid',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('vbscript:msgbox(1)')).toEqual({
      target: 'vbscript:msgbox(1)',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('about:blank')).toEqual({
      target: 'about:blank',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('filesystem:https://example.com/')).toEqual({
      target: 'filesystem:https://example.com/',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
    expect(parseMdLinkTarget('//evil.com/x')).toEqual({
      target: '//evil.com/x',
      isExternal: true,
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })
})

describe('WIKI_LINK_REGEX', () => {
  it('matches basic wiki links', () => {
    const matches = [...'See [[Note]] here'.matchAll(WIKI_LINK_REGEX)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('Note')
  })

  it('does not match nested brackets', () => {
    const matches = [...'[[outer [[inner]] ]]'.matchAll(WIKI_LINK_REGEX)]
    expect(matches.some((m) => m[1] === 'outer [[inner')).toBe(false)
  })
})

describe('MD_LINK_REGEX', () => {
  it('matches markdown links', () => {
    const matches = [...'[text](target)'.matchAll(MD_LINK_REGEX)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('text')
    expect(matches[0][2]).toBe('target')
  })

  it('does not match image links', () => {
    const matches = [...'![alt](img.png)'.matchAll(MD_LINK_REGEX)]
    expect(matches).toHaveLength(0)
  })
})

describe('extractLinksFromText', () => {
  it('returns wiki and markdown links in source order', () => {
    expect(
      extractLinksFromText('See [[Factions/The Guild|Guild]] and [Map](Maps/City#Gate)'),
    ).toEqual([
      expect.objectContaining({
        syntax: 'wiki',
        itemPath: ['Factions', 'The Guild'],
        displayName: 'Guild',
        rawTarget: 'Factions/The Guild|Guild',
      }),
      expect.objectContaining({
        syntax: 'md',
        itemPath: ['Maps', 'City'],
        headingPath: ['Gate'],
        displayName: 'Map',
        rawTarget: 'Maps/City#Gate',
      }),
    ])
  })

  it('preserves external markdown targets as link queries', () => {
    const [link] = extractLinksFromText('See [Portal](https://example.com/path?x=1)')

    expect(link).toEqual(
      expect.objectContaining({
        isExternal: true,
        rawTarget: 'https://example.com/path?x=1',
      }),
    )
    expect(getLinkQuery(link)).toBe('https://example.com/path?x=1')
  })
})
