import { describe, expect, it } from 'vitest'
import { createLinkDecorationState, LINK_ROLE } from '../link-decoration'

describe('createLinkDecorationState', () => {
  it('builds shared attrs for resolved wiki links', () => {
    const state = createLinkDecorationState({
      type: 'wiki',
      exists: true,
      href: '/campaigns/dm/world/editor?item=lore',
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
      'data-link-path': 'Lore',
      'data-link-item-name': 'Lore',
      'data-link-heading': 'Places#Capital',
    })
    expect(state.createPartAttrs(LINK_ROLE.content, true)).toEqual({
      'data-link-role': 'content',
      'data-link-status': 'exists',
      'data-link-viewer': 'false',
      'data-link-active': 'true',
      'data-link-exists': 'true',
      'data-link-type': 'wiki',
      'data-link-href': '/campaigns/dm/world/editor?item=lore',
      'data-link-path': 'Lore',
      'data-link-item-name': 'Lore',
      'data-link-heading': 'Places#Capital',
    })
  })

  it('marks ghost wiki links without resolved-only attrs', () => {
    const state = createLinkDecorationState({
      type: 'wiki',
      exists: false,
      href: null,
      itemPath: ['Maps', 'Ghost Note'],
      itemName: 'Ghost Note',
      heading: null,
      color: null,
      isViewerMode: true,
      isActive: false,
    })

    expect(state.status).toBe('ghost')
    expect(state.style).toBeUndefined()
    expect(state.createPartAttrs(LINK_ROLE.prefix, true)).toEqual({
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
      exists: true,
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
    expect(state.createPartAttrs(LINK_ROLE.content, true)).toEqual({
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
      exists: true,
      href: '/campaigns/dm/world/editor?item=journal',
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
      'data-link-path': 'Journals/Journal',
      'data-link-item-name': 'Journal',
      'data-link-heading': 'Day 1',
    })
    expect(state.createPartAttrs(LINK_ROLE.bracketOpen)).toEqual({
      'data-link-role': 'bracket-open',
      'data-link-status': 'exists',
      'data-link-viewer': 'false',
      'data-link-active': 'false',
    })
  })
})
