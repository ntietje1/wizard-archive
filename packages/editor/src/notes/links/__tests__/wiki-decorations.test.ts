import type { Decoration } from '@tiptap/pm/view'
import type { ParsedWikiLinkFields } from '../../../../../../shared/links/parsing'
import { describe, expect, it } from 'vite-plus/test'
import { buildWikiLinkDecorationEntries } from '../wiki-decorations'

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

describe('wiki link decoration entries', () => {
  it('emits a stable wiki alias shape with prefix and clickable content attrs', () => {
    const innerText = 'Lore/Capital#District|The Capital'
    const parsed = {
      pathKind: 'global',
      itemPath: ['Lore', 'Capital'],
      itemName: 'Capital',
      headingPath: ['District'],
      displayName: 'The Capital',
    } satisfies ParsedWikiLinkFields
    const decorations = buildWikiLinkDecorationEntries(
      {
        from: 10,
        to: 10 + innerText.length + 4,
        innerText,
        parsed,
        resolved: {
          syntax: 'wiki',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayName,
          rawTarget: innerText,
          isExternal: false,
          status: 'resolved',
          rejectionReason: null,
          itemId: 'capital-id',
          itemSlug: 'capital',
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
        'data-link-item-id': 'capital-id',
        'data-link-slug': 'capital',
      }),
    )
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'content')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-content',
        'data-link-role': 'content',
        'data-link-type': 'wiki',
        'data-link-path': 'Lore/Capital',
        'data-link-item-id': 'capital-id',
        'data-link-slug': 'capital',
        'data-link-heading': 'District',
        'data-link-active': 'true',
      }),
    )
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'bracket-open')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-bracket wiki-link-bracket-open',
        'data-link-role': 'bracket-open',
        'data-link-type': 'wiki',
        'data-link-slug': 'capital',
      }),
    )
  })

  it('keeps empty wiki aliases on the alias decoration path', () => {
    const innerText = 'Lore/Capital|'
    const parsed = {
      pathKind: 'global',
      itemPath: ['Lore', 'Capital'],
      itemName: 'Capital',
      headingPath: [],
      displayName: '',
    } satisfies ParsedWikiLinkFields
    const decorations = buildWikiLinkDecorationEntries(
      {
        from: 3,
        to: 3 + innerText.length + 4,
        innerText,
        parsed,
        resolved: {
          syntax: 'wiki',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayName,
          rawTarget: innerText,
          isExternal: false,
          status: 'resolved',
          rejectionReason: null,
          itemId: 'capital-id',
          itemSlug: 'capital',
          href: null,
          color: null,
        },
      },
      { isViewerMode: false, isActive: false },
    )

    expect(getRoleSequence(decorations)).toEqual(['bracket-open', 'prefix', 'bracket-close'])
    expect(getDecorationAttrs(findDecorationByRole(decorations, 'prefix')!)).toEqual(
      expect.objectContaining({
        class: 'wiki-link wiki-link-hidden-prefix',
        'data-link-role': 'prefix',
        'data-link-type': 'wiki',
        'data-link-slug': 'capital',
      }),
    )
  })

  it('emits a ghost wiki content segment for unresolved non-alias links', () => {
    const parsed = {
      pathKind: 'global',
      itemPath: ['Lore', 'Capital'],
      itemName: 'Capital',
      headingPath: [],
      displayName: null,
    } satisfies ParsedWikiLinkFields
    const decorations = buildWikiLinkDecorationEntries(
      {
        from: 4,
        to: 20,
        innerText: 'Lore/Capital',
        parsed,
        resolved: {
          syntax: 'wiki',
          pathKind: parsed.pathKind,
          itemPath: parsed.itemPath,
          itemName: parsed.itemName,
          headingPath: parsed.headingPath,
          displayName: parsed.displayName,
          rawTarget: 'Lore/Capital',
          isExternal: false,
          status: 'unresolved',
          rejectionReason: null,
          itemId: null,
          itemSlug: null,
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
})
