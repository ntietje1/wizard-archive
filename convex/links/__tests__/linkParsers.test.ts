import { describe, expect, it } from 'vite-plus/test'
import {
  parseWikiLinkText,
  parseMdLinkTarget,
  isExternalUrl,
  extractWikiLinksFromText,
  extractMdLinksFromText,
  WIKI_LINK_REGEX,
  MD_LINK_REGEX,
} from '../linkParsers'

describe('parseWikiLinkText', () => {
  it('parses a simple name', () => {
    const result = parseWikiLinkText('My Note')
    expect(result).toEqual({
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: [],
      displayName: null,
    })
  })

  it('parses a path with folders', () => {
    const result = parseWikiLinkText('Factions/The Guild')
    expect(result).toEqual({
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: [],
      displayName: null,
    })
  })

  it('parses heading path', () => {
    const result = parseWikiLinkText('My Note#Section#Subsection')
    expect(result).toEqual({
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: ['Section', 'Subsection'],
      displayName: null,
    })
  })

  it('parses display name', () => {
    const result = parseWikiLinkText('Factions/The Guild|The Guild')
    expect(result).toEqual({
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: [],
      displayName: 'The Guild',
    })
  })

  it('parses path + heading + display name', () => {
    const result = parseWikiLinkText('Factions/The Guild#Leaders|Guild Leaders')
    expect(result).toEqual({
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: ['Leaders'],
      displayName: 'Guild Leaders',
    })
  })

  it('handles empty string', () => {
    const result = parseWikiLinkText('')
    expect(result).toEqual({
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: null,
    })
  })

  it('trims whitespace from segments', () => {
    const result = parseWikiLinkText(' Factions / The Guild # Leaders ')
    expect(result).toEqual({
      itemPath: ['Factions', 'The Guild'],
      itemName: 'The Guild',
      headingPath: ['Leaders'],
      displayName: null,
    })
  })
})

describe('parseMdLinkTarget', () => {
  it('handles empty string as an internal unresolved target', () => {
    const result = parseMdLinkTarget('')
    expect(result).toEqual({
      target: '',
      isExternal: false,
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
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: ['H1', 'H2'],
    })
  })

  it('detects external URLs', () => {
    const result = parseMdLinkTarget('https://example.com')
    expect(result).toEqual({
      target: 'https://example.com',
      isExternal: true,
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
      itemPath: [],
      itemName: '',
      headingPath: [],
    })
  })
})

describe('isExternalUrl', () => {
  it('returns true for https', () => {
    expect(isExternalUrl('https://example.com')).toBe(true)
  })

  it('returns true for http', () => {
    expect(isExternalUrl('http://example.com')).toBe(true)
  })

  it('returns false for internal paths', () => {
    expect(isExternalUrl('Factions/Note')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isExternalUrl('HTTPS://example.com')).toBe(true)
  })
})

describe('extractWikiLinksFromText', () => {
  it('extracts a single wiki link', () => {
    const result = extractWikiLinksFromText('See [[My Note]] for details')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      syntax: 'wiki',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: [],
      displayName: null,
      rawTarget: 'My Note',
      isExternal: false,
    })
  })

  it('extracts multiple wiki links', () => {
    const result = extractWikiLinksFromText('Link to [[Note A]] and [[Folder/Note B]]')
    expect(result).toHaveLength(2)
    expect(result[0].itemName).toBe('Note A')
    expect(result[1].itemPath).toEqual(['Folder', 'Note B'])
  })

  it('returns empty array for no matches', () => {
    expect(extractWikiLinksFromText('no links here')).toEqual([])
  })

  it('handles link with display name', () => {
    const result = extractWikiLinksFromText('See [[Note|Custom Name]]')
    expect(result[0].displayName).toBe('Custom Name')
  })
})

describe('extractMdLinksFromText', () => {
  it('extracts internal markdown links', () => {
    const result = extractMdLinksFromText('See [click here](My Note) for details')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      syntax: 'md',
      itemPath: ['My Note'],
      itemName: 'My Note',
      headingPath: [],
      displayName: 'click here',
      rawTarget: 'My Note',
      isExternal: false,
    })
  })

  it('extracts external markdown links', () => {
    const result = extractMdLinksFromText('Visit [Google](https://google.com)')
    expect(result).toHaveLength(1)
    expect(result[0].isExternal).toBe(true)
    expect(result[0].rawTarget).toBe('https://google.com')
  })

  it('does not match image syntax', () => {
    const result = extractMdLinksFromText('![alt](image.png)')
    expect(result).toEqual([])
  })
})

describe('WIKI_LINK_REGEX', () => {
  it('matches basic wiki links', () => {
    const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')
    const matches = [...'See [[Note]] here'.matchAll(regex)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('Note')
  })

  it('does not match nested brackets', () => {
    const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')
    const matches = [...'[[outer [[inner]] ]]'.matchAll(regex)]
    expect(matches.some((m) => m[1] === 'outer [[inner')).toBe(false)
  })
})

describe('MD_LINK_REGEX', () => {
  it('matches markdown links', () => {
    const regex = new RegExp(MD_LINK_REGEX.source, 'g')
    const matches = [...'[text](target)'.matchAll(regex)]
    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('text')
    expect(matches[0][2]).toBe('target')
  })

  it('does not match image links', () => {
    const regex = new RegExp(MD_LINK_REGEX.source, 'g')
    const matches = [...'![alt](img.png)'.matchAll(regex)]
    expect(matches).toHaveLength(0)
  })
})
