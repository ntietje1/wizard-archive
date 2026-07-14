import { parseMdLinkTarget } from '../../../../../../shared/links/parsing'
import type { Decoration } from '@tiptap/pm/view'
import { describe, expect, it } from 'vite-plus/test'
import { buildMdLinkDecorationEntries } from '../md-decorations'

function getDecorationAttrs(decoration: Decoration) {
  return (decoration as Decoration & { type: { attrs: Record<string, string> } }).type.attrs
}

function getRoleSequence(decorations: Array<Decoration>) {
  return decorations
    .map((decoration) => getDecorationAttrs(decoration)['data-link-role'])
    .filter((role): role is string => typeof role === 'string')
}

describe('link decoration entries', () => {
  it('emits md internal content and target roles with shared attrs', () => {
    const displayText = 'Capital'
    const target = 'Lore/Capital#District'
    const parsed = { displayText, ...parseMdLinkTarget(target) }
    const decorations = buildMdLinkDecorationEntries(
      {
        from: 12,
        to: 12 + displayText.length + target.length + 4,
        displayText,
        target,
        parsed,
        resolved: {
          syntax: 'md',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayText,
          rawTarget: target,
          isExternal: false,
          status: 'resolved',
          rejectionReason: null,
          itemId: 'capital-id',
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
        'data-link-item-id': 'capital-id',
        'data-link-heading': 'District',
        'data-link-href': '/campaigns/dm/world/editor?item=capital&heading=District',
      }),
    )
    expect(getDecorationAttrs(decorations[3])).toEqual(
      expect.objectContaining({
        class: 'md-link-target',
        'data-link-role': 'target',
        'data-link-type': 'md-internal',
        'data-link-path': 'Lore/Capital',
        'data-link-item-id': 'capital-id',
        'data-link-heading': 'District',
        'data-link-href': '/campaigns/dm/world/editor?item=capital&heading=District',
        'data-link-status': 'exists',
        'data-link-active': 'true',
      }),
    )
    expect(getDecorationAttrs(decorations[0])).toEqual(
      expect.objectContaining({
        class: 'md-link-bracket md-link-bracket-open',
        'data-link-role': 'bracket-open',
        'data-link-type': 'md-internal',
      }),
    )
  })

  it('keeps md external links on the shared external state', () => {
    const displayText = 'Docs'
    const target = 'https://example.com/docs'
    const parsed = { displayText, ...parseMdLinkTarget(target) }
    const decorations = buildMdLinkDecorationEntries(
      {
        from: 2,
        to: 2 + displayText.length + target.length + 4,
        displayText,
        target,
        parsed,
        resolved: {
          syntax: 'md',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayText,
          rawTarget: target,
          isExternal: true,
          status: 'resolved',
          rejectionReason: null,
          itemId: null,
          href: target,
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
        'data-link-href': target,
      }),
    )
  })

  it('renders rejected external links as blocked instead of successful', () => {
    const displayText = 'Unsafe'
    const target = 'javascript:alert(1)'
    const parsed = { displayText, ...parseMdLinkTarget(target) }
    const decorations = buildMdLinkDecorationEntries(
      {
        from: 2,
        to: 2 + displayText.length + target.length + 4,
        displayText,
        target,
        parsed,
        resolved: {
          syntax: 'md',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayText,
          rawTarget: target,
          isExternal: true,
          status: 'rejected',
          rejectionReason: 'dangerous_url',
          itemId: null,
          href: null,
          color: null,
        },
      },
      { isViewerMode: false, isActive: false },
    )

    expect(getDecorationAttrs(decorations[1])).toEqual(
      expect.objectContaining({
        'data-link-exists': 'false',
        'data-link-status': 'rejected',
      }),
    )
    expect(getDecorationAttrs(decorations[1])).not.toHaveProperty('data-link-href')
  })
})
