import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLinkAt } from '../link-hit-testing'

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
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('finds wiki existing links through generic content roles', () => {
    const linkEl = document.createElement('span')
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'wiki')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-item-name', 'Capital')
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
    linkEl.className = 'md-link-display'
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'md-internal')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-path', 'Journals/Journal')
    linkEl.setAttribute('data-link-item-name', 'Journal')
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
        heading: 'Day 1',
      }),
    )
  })

  it('finds md external links through generic content roles', () => {
    const linkEl = document.createElement('span')
    linkEl.setAttribute('data-link-role', 'content')
    linkEl.setAttribute('data-link-type', 'md-external')
    linkEl.setAttribute('data-link-exists', 'true')
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

  it('returns null when no element is present at the point', () => {
    mockElementFromPoint(null)

    expect(getLinkAt(4, 4)).toBeNull()
  })

  it('returns null when the element is not a link target', () => {
    const plainEl = document.createElement('div')
    document.body.appendChild(plainEl)

    mockElementFromPoint(plainEl)

    expect(getLinkAt(6, 6)).toBeNull()
  })

  it('falls back to the legacy wiki-link content class when data-link-role is absent', () => {
    const linkEl = document.createElement('span')
    linkEl.className = 'wiki-link-content'
    linkEl.setAttribute('data-link-type', 'wiki')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-item-name', 'Legacy Wiki')
    document.body.appendChild(linkEl)

    mockElementFromPoint(linkEl)

    expect(getLinkAt(2, 2)).toEqual(
      expect.objectContaining({
        element: linkEl,
        type: 'wiki',
        itemPath: [],
        itemName: 'Legacy Wiki',
      }),
    )
  })

  it('falls back to the legacy md-link display class when data-link-role is absent', () => {
    const linkEl = document.createElement('span')
    linkEl.className = 'md-link-display'
    linkEl.setAttribute('data-link-type', 'md-internal')
    linkEl.setAttribute('data-link-exists', 'true')
    linkEl.setAttribute('data-link-href', '/dest?item=legacy-md')
    document.body.appendChild(linkEl)

    mockElementFromPoint(linkEl)

    expect(getLinkAt(3, 3)).toEqual(
      expect.objectContaining({
        element: linkEl,
        type: 'md-internal',
        itemPath: [],
        href: '/dest?item=legacy-md',
      }),
    )
  })
})
