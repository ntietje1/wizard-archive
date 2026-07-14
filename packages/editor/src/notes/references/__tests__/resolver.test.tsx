import type { ResourceId } from '../../../resources/domain-id'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { canonicalizeResourceItemTitle, assertResourceItemSlug } from '../../../workspace/items'
import type { AnyItem } from '../../../workspace/items'
import { createResourceCatalogModel } from '../../../filesystem/catalog'
import { createLinkResolver } from '../resolver'

describe('createLinkResolver', () => {
  beforeEach(() => {
    mockWorkspaceItems([])
  })

  it('keeps safe external urls clickable', () => {
    const resolver = createCatalogLinkResolver()

    const resolved = resolver.resolveLink({
      syntax: 'md',
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Docs',
      rawTarget: 'https://example.com/docs',
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      status: 'resolved',
      rejectionReason: null,
      itemId: null,
      href: 'https://example.com/docs',
      isExternal: true,
    })
  })

  it('uses explicit caller-owned viewer mode', () => {
    const resolver = createCatalogLinkResolver(undefined, { isViewerMode: true })

    expect(resolver.isViewerMode).toBe(true)
  })

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript', 'vbscript:msgbox("x")'],
  ])('rejects %s urls', (_, rawTarget) => {
    const resolver = createCatalogLinkResolver()

    const resolved = resolver.resolveLink({
      syntax: 'md',
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Bad',
      rawTarget,
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      status: 'rejected',
      rejectionReason: 'dangerous_url',
      itemId: null,
      href: null,
      isExternal: true,
    })
  })

  it('resolves relative links from the source note parent', () => {
    mockWorkspaceItems([
      {
        id: 'folder-1' as ResourceId,
        name: canonicalizeResourceItemTitle('Lore'),
        parentId: null,
        slug: assertResourceItemSlug('lore'),
      },
      {
        id: 'note-1' as ResourceId,
        name: canonicalizeResourceItemTitle('Current Note'),
        parentId: 'folder-1' as ResourceId,
        slug: assertResourceItemSlug('current-note'),
      },
      {
        id: 'note-2' as ResourceId,
        name: canonicalizeResourceItemTitle('Sibling Note'),
        parentId: 'folder-1' as ResourceId,
        slug: assertResourceItemSlug('sibling-note'),
      },
    ])

    const resolver = createCatalogLinkResolver('note-1' as ResourceId)

    const resolved = resolver.resolveLink({
      syntax: 'wiki',
      pathKind: 'relative',
      itemPath: ['.', 'Sibling Note'],
      itemName: 'Sibling Note',
      headingPath: [],
      displayName: null,
      rawTarget: './Sibling Note',
      isExternal: false,
    })

    expect(resolved).toMatchObject({
      status: 'resolved',
      rejectionReason: null,
      itemId: 'note-2',
      itemSlug: 'sibling-note',
      href: null,
      isExternal: false,
    })
  })

  it('resolves internal heading links without browser href construction', () => {
    mockWorkspaceItems([
      {
        id: 'note-1' as ResourceId,
        name: canonicalizeResourceItemTitle('Current Note'),
        parentId: null,
        slug: assertResourceItemSlug('current-note'),
      },
      {
        id: 'note-2' as ResourceId,
        name: canonicalizeResourceItemTitle('Sibling Note'),
        parentId: null,
        slug: assertResourceItemSlug('sibling-note'),
      },
    ])

    const resolver = createCatalogLinkResolver('note-1' as ResourceId)

    const resolved = resolver.resolveLink({
      syntax: 'wiki',
      pathKind: 'global',
      itemPath: ['Sibling Note'],
      itemName: 'Sibling Note',
      headingPath: ['Intro', 'Details'],
      displayName: null,
      rawTarget: 'Sibling Note#Intro#Details',
      isExternal: false,
    })

    expect(resolved).toMatchObject({
      status: 'resolved',
      rejectionReason: null,
      itemId: 'note-2',
      itemSlug: 'sibling-note',
      href: null,
    })
  })

  it('resolves heading-only links against the source note', () => {
    mockWorkspaceItems([
      {
        id: 'note-1' as ResourceId,
        name: canonicalizeResourceItemTitle('Current Note'),
        parentId: null,
        slug: assertResourceItemSlug('current-note'),
      },
    ])

    const resolver = createCatalogLinkResolver('note-1' as ResourceId)

    const resolved = resolver.resolveLink({
      syntax: 'wiki',
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: ['Intro'],
      displayName: null,
      rawTarget: '#Intro',
      isExternal: false,
    })

    expect(resolved).toMatchObject({
      status: 'resolved',
      rejectionReason: null,
      itemId: 'note-1',
      itemSlug: 'current-note',
      href: null,
    })
  })
})

let currentPaths = createResourceCatalogModel({
  activeItems: [],
  trashItems: [],
}).paths
let currentItemsById = new Map<ResourceId, AnyItem>()

function createCatalogLinkResolver(
  sourceNoteId?: ResourceId,
  options: { isViewerMode: boolean } = { isViewerMode: false },
) {
  return createLinkResolver({
    isViewerMode: options.isViewerMode,
    revision: 'test',
    resolveItemPath: (parsed) =>
      parsed.itemPath.length === 0 && sourceNoteId
        ? (currentItemsById.get(sourceNoteId) ?? null)
        : currentPaths.resolveVisibleItemPath({
            pathKind: parsed.pathKind,
            pathSegments: parsed.itemPath,
            sourceItemId: sourceNoteId,
          }),
  })
}

function mockWorkspaceItems(items: Array<Partial<AnyItem> & { id: ResourceId }>) {
  const activeItems = items as Array<AnyItem>
  currentPaths = createResourceCatalogModel({
    activeItems,
    trashItems: [],
  }).paths
  currentItemsById = new Map(activeItems.map((item) => [item.id, item]))
}
