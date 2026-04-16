import { parseMdLinkTarget, parseWikiLinkText } from 'convex/links/linkParsers'
import type { Decoration } from '@tiptap/pm/view'
import { describe, expect, it } from 'vitest'
import { buildMdLinkDecorationEntries } from '../md-link-decorations'
import { buildWikiLinkDecorationEntries } from '../wiki-link-decorations'

function getDecorationAttrs(decoration: Decoration) {
  return (decoration as Decoration & { type: { attrs: Record<string, string> } }).type.attrs
}

function getRoleSequence(decorations: Array<Decoration>) {
  return decorations
    .map((decoration) => getDecorationAttrs(decoration)['data-link-role'])
    .filter((role): role is string => typeof role === 'string')
}

function findDecorationByRole(decorations: Array<Decoration>, role: string) {
  return decorations.find((decoration) => getDecorationAttrs(decoration)['data-link-role'] === role)
}

describe('link decoration entries', () => {
  it('emits a stable wiki alias shape with prefix and clickable content attrs', () => {
    const parsed = parseWikiLinkText('Lore/Capital#District|The Capital')
    const decorations = buildWikiLinkDecorationEntries(
      {
        from: 10,
        to: 44,
        innerText: 'Lore/Capital#District|The Capital',
        parsed,
        resolved: {
          syntax: 'wiki',
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayName,
          rawTarget: 'Lore/Capital#District|The Capital',
          isExternal: false,
          resolved: true,
          itemId: null,
          href: '/campaigns/dm/world/editor?item=capital&heading=District',
          color: '#334455',
        },
      },
      { isViewerMode: false, isActive: true },
    )

    expect(decorations).toHaveLength(4)
    expect(getRoleSequence(decorations)).toEqual([
      'bracket-open',
      'prefix',
      'content',
      'bracket-close',
    ])
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'prefix')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-hidden-prefix',
        'data-link-role': 'prefix',
        'data-link-type': 'wiki',
        'data-link-status': 'exists',
        'data-link-item-name': 'Capital',
      }),
    )
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'content')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-content',
        'data-link-role': 'content',
        'data-link-type': 'wiki',
        'data-link-path': 'Lore/Capital',
        'data-link-heading': 'District',
        'data-link-active': 'true',
      }),
    )
  })

  it('omits the wiki prefix segment when there is no alias', () => {
    const parsed = parseWikiLinkText('Lore/Capital')
    const decorations = buildWikiLinkDecorationEntries(
      {
        from: 4,
        to: 20,
        innerText: 'Lore/Capital',
        parsed,
        resolved: {
          syntax: 'wiki',
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayName,
          rawTarget: 'Lore/Capital',
          isExternal: false,
          resolved: false,
          itemId: null,
          href: null,
          color: null,
        },
      },
      { isViewerMode: true, isActive: false },
    )

    expect(decorations).toHaveLength(3)
    expect(getRoleSequence(decorations)).toEqual(['bracket-open', 'content', 'bracket-close'])
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'content')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-content',
        'data-link-role': 'content',
        'data-link-status': 'ghost',
        'data-link-viewer': 'true',
        'data-link-path': 'Lore/Capital',
        'data-link-item-name': 'Capital',
      }),
    )
  })

  it('emits md internal content and target roles with shared attrs', () => {
    const parsed = { displayText: 'Capital', ...parseMdLinkTarget('Lore/Capital#District') }
    const decorations = buildMdLinkDecorationEntries(
      {
        from: 12,
        to: 38,
        displayText: 'Capital',
        target: 'Lore/Capital#District',
        parsed,
        resolved: {
          syntax: 'md',
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayText,
          rawTarget: 'Lore/Capital#District',
          isExternal: false,
          resolved: true,
          itemId: null,
          href: '/campaigns/dm/world/editor?item=capital&heading=District',
          color: '#556677',
        },
      },
      { isViewerMode: false, isActive: true },
    )

    expect(decorations).toHaveLength(5)
    expect(getRoleSequence(decorations)).toEqual([
      'bracket-open',
      'content',
      'bracket-middle',
      'target',
      'bracket-close',
    ])
    expect(getDecorationAttrs(decorations[1])).toEqual(
      expect.objectContaining({
        class: 'md-link-display',
        'data-link-role': 'content',
        'data-link-type': 'md-internal',
        'data-link-status': 'exists',
        'data-link-path': 'Lore/Capital',
        'data-link-heading': 'District',
      }),
    )
    expect(getDecorationAttrs(decorations[3])).toEqual(
      expect.objectContaining({
        class: 'md-link-target',
        'data-link-role': 'target',
        'data-link-active': 'true',
      }),
    )
  })

  it('keeps md external links on the shared external state', () => {
    const parsed = { displayText: 'Docs', ...parseMdLinkTarget('https://example.com/docs') }
    const decorations = buildMdLinkDecorationEntries(
      {
        from: 2,
        to: 30,
        displayText: 'Docs',
        target: 'https://example.com/docs',
        parsed,
        resolved: {
          syntax: 'md',
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayText,
          rawTarget: 'https://example.com/docs',
          isExternal: true,
          resolved: true,
          itemId: null,
          href: 'https://example.com/docs',
          color: null,
        },
      },
      { isViewerMode: false, isActive: false },
    )

    expect(decorations).toHaveLength(5)
    expect(getRoleSequence(decorations)).toEqual([
      'bracket-open',
      'content',
      'bracket-middle',
      'target',
      'bracket-close',
    ])
    expect(getDecorationAttrs(decorations[1])).toEqual(
      expect.objectContaining({
        class: 'md-link-display',
        'data-link-role': 'content',
        'data-link-type': 'md-external',
        'data-link-status': 'external',
        'data-link-href': 'https://example.com/docs',
      }),
    )
  })
})
