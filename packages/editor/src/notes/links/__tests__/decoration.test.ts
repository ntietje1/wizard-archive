import { describe, expect, it } from 'vite-plus/test'
import { createLinkDecorationState, LINK_ROLE } from '../decoration'

describe('createLinkDecorationState', () => {
  it('builds shared attrs for resolved wiki links', () => {
    const state = createLinkDecorationState({
      type: 'wiki',
      resolutionStatus: 'resolved',
      href: '/campaigns/dm/world/editor?item=lore',
      itemId: 'lore-id',
      itemSlug: 'lore',
      pathKind: 'global',
      itemPath: ['Lore'],
      itemName: 'Lore',
      heading: 'Places#Capital',
      color: '#123456',
      isViewerMode: false,
      isActive: true,
    })

    expect(state.status).toBe('exists')
    expect(state.interaction).toEqual({ viewer: false, active: true })
    expect(state.style).toBe('color: #123456')
    expect(state.linkAttrs).toEqual({
      'data-link-exists': 'true',
      'data-link-type': 'wiki',
      'data-link-href': '/campaigns/dm/world/editor?item=lore',
      'data-link-item-id': 'lore-id',
      'data-link-slug': 'lore',
      'data-link-path-kind': 'global',
      'data-link-path': 'Lore',
      'data-link-item-name': 'Lore',
      'data-link-heading': 'Places#Capital',
    })
    expect(state.createPartAttrs(LINK_ROLE.content)).toEqual({
      'data-link-role': 'content',
      'data-link-status': 'exists',
      'data-link-viewer': 'false',
      'data-link-active': 'true',
      'data-link-exists': 'true',
      'data-link-type': 'wiki',
      'data-link-href': '/campaigns/dm/world/editor?item=lore',
      'data-link-item-id': 'lore-id',
      'data-link-slug': 'lore',
      'data-link-path-kind': 'global',
      'data-link-path': 'Lore',
      'data-link-item-name': 'Lore',
      'data-link-heading': 'Places#Capital',
    })
  })

  it('marks ghost wiki links with unresolved link attrs', () => {
    const state = createLinkDecorationState({
      type: 'wiki',
      resolutionStatus: 'unresolved',
      href: null,
      itemPath: ['Maps', 'Ghost Note'],
      itemName: 'Ghost Note',
      heading: null,
      color: null,
      isViewerMode: true,
      isActive: false,
    })

    expect(state.status).toBe('ghost')
    expect(state.createPartAttrs(LINK_ROLE.prefix)).toEqual({
      'data-link-role': 'prefix',
      'data-link-status': 'ghost',
      'data-link-viewer': 'true',
      'data-link-active': 'false',
      'data-link-exists': 'false',
      'data-link-type': 'wiki',
      'data-link-path': 'Maps/Ghost Note',
      'data-link-item-name': 'Ghost Note',
    })
  })

  it('marks md external links as external even though they exist', () => {
    const state = createLinkDecorationState({
      type: 'md-external',
      resolutionStatus: 'resolved',
      href: 'https://example.com',
      itemPath: null,
      itemName: null,
      heading: null,
      color: null,
      isViewerMode: false,
      isActive: false,
    })

    expect(state.status).toBe('external')
    expect(state.linkAttrs).toEqual({
      'data-link-exists': 'true',
      'data-link-type': 'md-external',
      'data-link-href': 'https://example.com',
    })
    expect(state.createPartAttrs(LINK_ROLE.content)).toEqual({
      'data-link-role': 'content',
      'data-link-status': 'external',
      'data-link-viewer': 'false',
      'data-link-active': 'false',
      'data-link-exists': 'true',
      'data-link-type': 'md-external',
      'data-link-href': 'https://example.com',
    })
  })

  it('keeps md internal links on the shared internal contract', () => {
    const state = createLinkDecorationState({
      type: 'md-internal',
      resolutionStatus: 'resolved',
      href: '/campaigns/dm/world/editor?item=journal',
      itemId: 'journal-id',
      itemSlug: 'journal',
      pathKind: 'relative',
      itemPath: ['Journals', 'Journal'],
      itemName: 'Journal',
      heading: 'Day 1',
      color: '#abcdef',
      isViewerMode: false,
      isActive: false,
    })

    expect(state.status).toBe('exists')
    expect(state.linkAttrs).toEqual({
      'data-link-exists': 'true',
      'data-link-type': 'md-internal',
      'data-link-href': '/campaigns/dm/world/editor?item=journal',
      'data-link-item-id': 'journal-id',
      'data-link-slug': 'journal',
      'data-link-path-kind': 'relative',
      'data-link-path': 'Journals/Journal',
      'data-link-item-name': 'Journal',
      'data-link-heading': 'Day 1',
    })
    expect(state.createPartAttrs(LINK_ROLE.bracketOpen)).toEqual({
      'data-link-role': 'bracket-open',
      'data-link-status': 'exists',
      'data-link-viewer': 'false',
      'data-link-active': 'false',
      'data-link-exists': 'true',
      'data-link-type': 'md-internal',
      'data-link-href': '/campaigns/dm/world/editor?item=journal',
      'data-link-item-id': 'journal-id',
      'data-link-slug': 'journal',
      'data-link-path-kind': 'relative',
      'data-link-path': 'Journals/Journal',
      'data-link-item-name': 'Journal',
      'data-link-heading': 'Day 1',
    })
  })
})
