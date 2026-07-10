import { useEffect, useRef } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { BlockSearchResult } from '../../../../shared/search/types'
import type { ItemSearchInput, ItemSearchResult, ItemSearchState } from '../search/model'
import type { AnyItem } from '../workspace/items'
import {
  createStaticCatalogItemLinksCapability,
  getStaticCatalogBodySearchResults,
} from './catalog-static-search'
import type {
  StaticCatalogFileSystemSearchPaths,
  StaticCatalogSearchCatalog,
} from './catalog-static-search'
import { useResourceHydrationCache } from './resource-hydration-cache'
import type { ResourceHydrationEntry } from './resource-hydration-cache'

type ItemLinksKind = 'backlinks' | 'outgoing'

export interface ItemLink {
  id: string
  query: string
  displayName: string | null
  item: { id: SidebarItemId; name: string } | null
}

interface ItemLinksInput {
  itemId: SidebarItemId
  kind: ItemLinksKind
}

type ItemLinksState =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'success'; links: Array<ItemLink> }

export type ItemLinksCapability =
  | {
      status: 'unsupported'
      reason: 'not_available' | 'not_implemented'
    }
  | {
      status: 'available'
      getItemLinks: (input: ItemLinksInput) => ItemLinksState
    }

export type FileSystemSearch =
  | {
      status: 'unsupported'
      reason: 'not_implemented'
    }
  | {
      status: 'available'
      ensureSearchState: (input: ItemSearchInput) => void
      getSearchState: (input: ItemSearchInput) => ItemSearchState
      itemLinks: ItemLinksCapability
    }

type CatalogFileSystemSearchFactory<Catalog> = (input: {
  catalog: Catalog
  ensureSearchState: (input: ItemSearchInput) => void
  getSearchBodyState: (input: ItemSearchInput) => {
    bodyResults?: Array<BlockSearchResult>
    bodySearchError: unknown
    bodySearchPending: boolean
  }
  itemLinks: ItemLinksCapability
  recentItems?: Array<ItemSearchResult>
}) => Extract<FileSystemSearch, { status: 'available' }>

interface HydratedCatalogFileSystemSearchInput<
  SourceId extends string = string,
  Catalog = unknown,
> {
  catalog: Catalog
  createSearch: CatalogFileSystemSearchFactory<Catalog>
  itemLinks: ItemLinksCapability
  recentItems?: Array<ItemSearchResult>
  revision: string | number
  searchBody: (input: ItemSearchInput) => Promise<Array<BlockSearchResult> | undefined>
  sourceId: SourceId | null | undefined
}

interface StaticCatalogFileSystemSearchInput<Catalog extends StaticCatalogSearchCatalog> {
  catalog: Catalog
  createSearch: CatalogFileSystemSearchFactory<Catalog>
  createSearchResult: (catalog: Catalog, item: AnyItem) => ItemSearchResult
  currentContentItem: AnyItem | null | undefined
  paths: StaticCatalogFileSystemSearchPaths
}

export function useHydratedCatalogFileSystemSearch<SourceId extends string, Catalog>({
  catalog,
  createSearch,
  itemLinks,
  recentItems,
  revision,
  searchBody,
  sourceId,
}: HydratedCatalogFileSystemSearchInput<SourceId, Catalog>): FileSystemSearch {
  const hydration = useResourceHydrationCache<
    SourceId,
    string,
    Array<BlockSearchResult> | undefined
  >({
    load: (query) => searchBody({ query }),
  })
  const previousRevisionRef = useRef(revision)

  useEffect(() => {
    if (Object.is(previousRevisionRef.current, revision)) return
    previousRevisionRef.current = revision
    hydration.invalidateSource(sourceId)
  }, [hydration, revision, sourceId])

  return createSearch({
    catalog,
    ensureSearchState: (input) => {
      const query = input.query.trim()
      hydration.ensure({ key: query, sourceId })
    },
    getSearchBodyState: (input) =>
      createHydratedSearchBodyState({
        entry: hydration.getEntry({ key: input.query.trim(), sourceId }),
        input,
        sourceId,
      }),
    itemLinks,
    recentItems,
  })
}

export function createStaticCatalogFileSystemSearch<Catalog extends StaticCatalogSearchCatalog>({
  catalog,
  createSearch,
  createSearchResult,
  currentContentItem,
  paths,
}: StaticCatalogFileSystemSearchInput<Catalog>): Extract<
  FileSystemSearch,
  { status: 'available' }
> {
  return createSearch({
    catalog,
    ensureSearchState: () => undefined,
    getSearchBodyState: (input) => ({
      bodyResults: getStaticCatalogBodySearchResults(catalog, input.query),
      bodySearchError: null,
      bodySearchPending: false,
    }),
    itemLinks: createStaticCatalogItemLinksCapability({ catalog, paths }),
    recentItems: currentContentItem ? [createSearchResult(catalog, currentContentItem)] : [],
  })
}

function createHydratedSearchBodyState<SourceId extends string>({
  entry,
  input,
  sourceId,
}: {
  entry: ResourceHydrationEntry<SourceId, string, Array<BlockSearchResult> | undefined> | undefined
  input: ItemSearchInput
  sourceId: SourceId | null | undefined
}) {
  const query = input.query.trim()
  const bodyResults = entry?.status === 'success' ? entry.value : undefined
  const bodySearchError = entry?.status === 'error' ? entry.error : null

  return {
    bodySearchError,
    bodySearchPending: Boolean(query && sourceId) && (!entry || entry.status === 'loading'),
    bodyResults,
  }
}
