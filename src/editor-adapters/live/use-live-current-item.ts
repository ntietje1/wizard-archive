import { useMatch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type {
  WizardEditorItem,
  WizardEditorItemWithContent,
  WizardEditorResourceSlug,
} from '@wizard-archive/editor/adapter'
import { isPersistedWizardEditorItem } from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { EDITOR_ROUTE_ID } from './editor-route'
import { projectLiveSidebarItem } from './sidebar/project-live-sidebar-item'

export function useLiveCurrentItem({
  getKnownItemBySlug,
}: {
  getKnownItemBySlug: (slug: WizardEditorResourceSlug) => WizardEditorItem | null
}) {
  const { campaignId: workspaceRecordId } = useCampaign()

  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const slug = editorSearch.item ?? null

  const sidebarItemAccessQuery = useAuthQuery(
    api.sidebarItems.queries.resolveSidebarItemAccess,
    slug && workspaceRecordId
      ? { campaignId: workspaceRecordId, lookup: { kind: 'slug', slug } }
      : 'skip',
  )

  const optimisticItem = resolveOptimisticCurrentItem(slug, getKnownItemBySlug)
  const accessItems = projectCurrentItemAccessResult(sidebarItemAccessQuery.data, slug)
  const accessStatus = sidebarItemAccessQuery.data?.status ?? null
  const rawItem = slug ? (accessItems.contentItem ?? accessItems.item ?? optimisticItem) : null
  const state = resolveLiveCurrentItemState({
    slug,
    rawItem,
    queryStatus: sidebarItemAccessQuery.status,
    isFetching: sidebarItemAccessQuery.isFetching,
    queryError: sidebarItemAccessQuery.error,
    accessStatus,
  })

  return {
    ...state,
    accessStatus,
    contentItem: accessItems.contentItem,
    isTrashRequested: editorSearch.trash === true,
    requestedSlug: slug,
  }
}

type CurrentItemAccessResult =
  | { status: 'not_found' }
  | { status: 'not_shared' }
  | { status: 'trashed' }
  | { status: 'available'; item: WizardEditorItemWithContent }

function resolveOptimisticCurrentItem(
  slug: WizardEditorResourceSlug | null,
  getKnownItemBySlug: (slug: WizardEditorResourceSlug) => WizardEditorItem | null,
) {
  if (!slug) return null
  const knownItem = getKnownItemBySlug(slug)
  return knownItem && !isPersistedWizardEditorItem(knownItem) ? knownItem : null
}

function projectCurrentItemAccessResult(
  result: CurrentItemAccessResult | null | undefined,
  slug: WizardEditorResourceSlug | null,
): { item: WizardEditorItem | null; contentItem: WizardEditorItemWithContent | null } {
  if (!slug || !result || result.status !== 'available' || result.item.slug !== slug) {
    return { item: null, contentItem: null }
  }

  const item = projectLiveSidebarItem<WizardEditorItem>(result.item)
  return {
    item,
    contentItem: projectLiveSidebarItem<WizardEditorItemWithContent>(result.item),
  }
}

type CurrentItemQueryStatus = 'pending' | 'error' | 'success'

interface ResolvedCurrentItemState {
  item: WizardEditorItem | null
  itemType: WizardEditorItem['type'] | undefined
  isLoading: boolean
  isNotFound: boolean
  itemError: unknown
  hasRequestedItem: boolean
}

function resolveLiveCurrentItemState({
  isFetching,
  queryError,
  queryStatus,
  rawItem,
  slug,
  accessStatus,
}: {
  accessStatus: CurrentItemAccessResult['status'] | null
  isFetching: boolean
  queryError: unknown
  queryStatus: CurrentItemQueryStatus
  rawItem: WizardEditorItem | null
  slug: WizardEditorResourceSlug | null
}): ResolvedCurrentItemState {
  const item = rawItem && rawItem.slug === slug ? rawItem : null

  if (!slug) {
    return {
      item: null,
      itemType: undefined,
      isLoading: false,
      isNotFound: false,
      itemError: null,
      hasRequestedItem: false,
    }
  }

  if (item) {
    return {
      item,
      itemType: item.type,
      isLoading: false,
      isNotFound: false,
      itemError: null,
      hasRequestedItem: true,
    }
  }

  if (queryStatus === 'error') {
    return {
      item: null,
      itemType: undefined,
      isLoading: false,
      isNotFound: false,
      itemError: queryError,
      hasRequestedItem: true,
    }
  }

  const isNotFound =
    rawItem === null &&
    queryStatus === 'success' &&
    !isFetching &&
    accessStatus !== 'not_shared' &&
    accessStatus !== 'trashed'

  return {
    item: null,
    itemType: undefined,
    isLoading: !isNotFound,
    isNotFound,
    itemError: null,
    hasRequestedItem: true,
  }
}
