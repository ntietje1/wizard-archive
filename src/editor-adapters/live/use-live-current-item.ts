import { useMatch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type { WizardEditorItem, WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { EDITOR_ROUTE_ID } from './editor-route'
import { projectLiveSidebarItem } from './sidebar/project-live-sidebar-item'

export function useLiveCurrentItem({
  getKnownItemById,
}: {
  getKnownItemById: (resourceId: ResourceId) => WizardEditorItem | null
}) {
  const { campaignId: workspaceRecordId } = useCampaign()

  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  const editorSearch = editorMatch?.search ?? {}

  const resourceId = editorSearch.item ?? null

  const sidebarItemAccessQuery = useAuthQuery(
    api.sidebarItems.queries.resolveSidebarItemAccess,
    resourceId && workspaceRecordId
      ? { campaignId: workspaceRecordId, lookup: { kind: 'id', id: resourceId } }
      : 'skip',
  )

  const knownItem = resolveKnownCurrentItem(resourceId, getKnownItemById)
  const accessItems = projectCurrentItemAccessResult(sidebarItemAccessQuery.data, resourceId)
  const accessStatus = sidebarItemAccessQuery.data?.status ?? null
  const rawItem = resourceId ? (accessItems.contentItem ?? accessItems.item ?? knownItem) : null
  const state = resolveLiveCurrentItemState({
    resourceId,
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
    requestedResourceId: resourceId,
  }
}

type CurrentItemAccessResult =
  | { status: 'not_found' }
  | { status: 'not_shared' }
  | { status: 'trashed' }
  | { status: 'available'; item: WizardEditorItemWithContent }

function resolveKnownCurrentItem(
  resourceId: ResourceId | null,
  getKnownItemById: (resourceId: ResourceId) => WizardEditorItem | null,
) {
  if (!resourceId) return null
  return getKnownItemById(resourceId)
}

function projectCurrentItemAccessResult(
  result: CurrentItemAccessResult | null | undefined,
  resourceId: ResourceId | null,
): { item: WizardEditorItem | null; contentItem: WizardEditorItemWithContent | null } {
  if (!resourceId || !result || result.status !== 'available') {
    return { item: null, contentItem: null }
  }

  const item = projectLiveSidebarItem<WizardEditorItem>(result.item)
  if (item.id !== resourceId) return { item: null, contentItem: null }
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
  resourceId,
  accessStatus,
}: {
  accessStatus: CurrentItemAccessResult['status'] | null
  isFetching: boolean
  queryError: unknown
  queryStatus: CurrentItemQueryStatus
  rawItem: WizardEditorItem | null
  resourceId: ResourceId | null
}): ResolvedCurrentItemState {
  const item = rawItem && rawItem.id === resourceId ? rawItem : null

  if (!resourceId) {
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
