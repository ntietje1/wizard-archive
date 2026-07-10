import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { getLinkAt } from '../hit-testing'

const hadElementFromPoint = 'elementFromPoint' in document

function mockElementFromPoint(element: Element | null) {
  if (!('elementFromPoint' in document)) {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    })
  }
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(element)
}

describe('getLinkAt', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
    if (!hadElementFromPoint) {
      delete (document as { elementFromPoint?: unknown }).elementFromPoint
    }
  })

  it('finds wiki existing links through generic content roles', () => {
    const linkEl = document.createElement('span')
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'wiki')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-status', 'exists')
    linkEl.setAttribute('data-link-path-kind', 'global')
    linkEl.setAttribute('data-link-item-name', 'Capital')
    linkEl.setAttribute('data-link-item-id', 'capital-id')
    linkEl.setAttribute('data-link-slug', 'capital')
    linkEl.setAttribute('data-link-href', '/campaigns/dm/world/editor?item=capital')
    document.body.appendChild(linkEl)

    mockElementFromPoint(linkEl)

    expect(getLinkAt(10, 20)).toEqual(
      expect.objectContaining({
        element: linkEl,
        type: 'wiki',
        exists: true,
        itemPath: [],
        itemName: 'Capital',
        itemId: 'capital-id',
        itemSlug: 'capital',
      }),
    )
  })

  it('finds wiki ghost links through generic prefix roles', () => {
    const wrapper = document.createElement('span')
    const prefixEl = document.createElement('span')
    const child = document.createElement('strong')
    prefixEl.setAttribute('data-link-role', 'prefix')
    prefixEl.setAttribute('data-link-type', 'wiki')
    prefixEl.setAttribute('data-link-exists', 'false')
    prefixEl.setAttribute('data-link-status', 'ghost')
    prefixEl.setAttribute('data-link-path-kind', 'global')
    prefixEl.setAttribute('data-link-item-name', 'Missing Note')
    prefixEl.appendChild(child)
    wrapper.appendChild(prefixEl)
    document.body.appendChild(wrapper)

    mockElementFromPoint(child)

    expect(getLinkAt(5, 5)).toEqual(
      expect.objectContaining({
        element: prefixEl,
        type: 'wiki',
        exists: false,
        itemPath: [],
        itemName: 'Missing Note',
      }),
    )
  })

  it('finds md internal links through generic content roles', () => {
    const child = document.createElement('em')
    const linkEl = document.createElement('span')
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'md-internal')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-status', 'exists')
    linkEl.setAttribute('data-link-path-kind', 'global')
    linkEl.setAttribute('data-link-path', 'Journals/Journal')
    linkEl.setAttribute('data-link-item-name', 'Journal')
    linkEl.setAttribute('data-link-item-id', 'journal-id')
    linkEl.setAttribute('data-link-slug', 'journal')
    linkEl.setAttribute('data-link-heading', 'Day 1')
    linkEl.appendChild(child)
    document.body.appendChild(linkEl)

    mockElementFromPoint(child)

    expect(getLinkAt(8, 9)).toEqual(
      expect.objectContaining({
        element: linkEl,
        type: 'md-internal',
        exists: true,
        itemPath: ['Journals', 'Journal'],
        itemId: 'journal-id',
        itemSlug: 'journal',
        heading: 'Day 1',
      }),
    )
  })

  it('finds md external links through generic content roles', () => {
    const linkEl = document.createElement('span')
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'md-external')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-status', 'external')
    linkEl.setAttribute('data-link-href', 'https://example.com/docs')
    document.body.appendChild(linkEl)

    mockElementFromPoint(linkEl)

    expect(getLinkAt(1, 1)).toEqual(
      expect.objectContaining({
        element: linkEl,
        type: 'md-external',
        exists: true,
        itemPath: [],
        href: 'https://example.com/docs',
      }),
    )
  })

  it('finds internal links through rendered bracket and target roles', () => {
    const wrapper = document.createElement('span')
    const bracketEl = document.createElement('span')
    const targetEl = document.createElement('span')

    for (const linkEl of [bracketEl, targetEl]) {
      linkEl.setAttribute('data-link-type', 'md-internal')
      linkEl.setAttribute('data-link-exists', 'true')
      linkEl.setAttribute('data-link-status', 'exists')
      linkEl.setAttribute('data-link-path-kind', 'relative')
      linkEl.setAttribute('data-link-path', './Journal')
      linkEl.setAttribute('data-link-item-name', 'Journal')
      linkEl.setAttribute('data-link-item-id', 'journal-id')
      linkEl.setAttribute('data-link-slug', 'journal')
    }
    bracketEl.setAttribute('data-link-role', 'bracket-open')
    targetEl.setAttribute('data-link-role', 'target')

    wrapper.append(bracketEl, targetEl)
    document.body.appendChild(wrapper)

    mockElementFromPoint(bracketEl)
    expect(getLinkAt(3, 4)).toEqual(
      expect.objectContaining({
        element: bracketEl,
        type: 'md-internal',
        pathKind: 'relative',
        itemPath: ['.', 'Journal'],
        itemSlug: 'journal',
      }),
    )

    mockElementFromPoint(targetEl)
    expect(getLinkAt(5, 6)).toEqual(
      expect.objectContaining({
        element: targetEl,
        type: 'md-internal',
        pathKind: 'relative',
        itemPath: ['.', 'Journal'],
        itemSlug: 'journal',
      }),
    )
  })
})
