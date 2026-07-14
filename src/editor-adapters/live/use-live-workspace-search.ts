import { api } from 'convex/_generated/api'

import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import {
  createWizardEditorCatalogItemSearchResult,
  createWizardEditorCatalogItemLink,
  isPersistedWizardEditorItemId,
  isWizardEditorNoteItem,
  useWizardEditorHydratedCatalogResourceContentSource,
  useWizardEditorHydratedCatalogSearchSource,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorCurrentResourceState,
  WizardEditorItem,
  WizardEditorPermissionSource,
  WizardEditorResourceCatalog,
} from '@wizard-archive/editor/adapter'
import { useLiveRecentItems } from './live-recent-items'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'

type LiveWorkspaceSearchQueryClient = {
  query: <Query extends FunctionReference<'query', 'public'>>(
    query: Query,
    args: FunctionArgs<Query>,
  ) => Promise<FunctionReturnType<Query>>
}

export function useLiveWorkspaceSearch(
  workspaceId: CampaignId,
  convex: LiveWorkspaceSearchQueryClient,
  current: WizardEditorCurrentResourceState,
  currentItem: WizardEditorItem | null,
  filesystem: {
    catalog: WizardEditorResourceCatalog
    permissions: Pick<
      WizardEditorPermissionSource,
      'canAccessItem' | 'getMemberItemPermissionLevel'
    >
  },
  viewAsPlayerId: CampaignMemberId | null,
) {
  const { catalog, permissions } = filesystem
  const currentItemId = currentItem?.id ?? null
  const currentNoteItemId = isWizardEditorNoteItem(currentItem) ? currentItem.id : null
  const backlinks = useLiveItemLinksState({ itemId: currentItemId, kind: 'backlinks' })
  const outgoing = useLiveItemLinksState({ itemId: currentNoteItemId, kind: 'outgoing' })
  const visibleItems = [...catalog.queryVisibleItems()]
  const recentItems = useLiveRecentItems(visibleItems, (item) =>
    createWizardEditorCatalogItemSearchResult(catalog, item),
  )
  const searchRevision = isWizardEditorNoteItem(current.contentItem)
    ? JSON.stringify(current.contentItem.content)
    : (current.contentItem?.updatedTime ?? 0)

  const sourceId = viewAsPlayerId ? `${workspaceId}:view-as:${viewAsPlayerId}` : workspaceId
  const searchSource = useWizardEditorHydratedCatalogSearchSource({
    catalog,
    itemLinks: {
      status: 'available',
      getItemLinks: ({ itemId, kind }) => {
        if (itemId !== currentItemId) return { status: 'pending' }
        return kind === 'backlinks' ? backlinks : outgoing
      },
    },
    recentItems,
    revision: searchRevision,
    searchBody: async (input) => {
      const bodyResults = viewAsPlayerId
        ? await convex.query(api.blocks.queries.searchBlocksAsMember, {
            campaignId: workspaceId,
            campaignMemberId: viewAsPlayerId,
            query: input.query,
          })
        : await convex.query(api.blocks.queries.searchBlocks, {
            campaignId: workspaceId,
            query: input.query,
          })
      return Array.isArray(bodyResults) ? bodyResults : undefined
    },
    sourceId,
  })
  const resourceContent = useWizardEditorHydratedCatalogResourceContentSource({
    catalog,
    current,
    loadItemContent: async (itemId: ResourceId) => {
      const result = await convex.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
        campaignId: workspaceId,
        lookup: { kind: 'id', id: itemId },
      })
      return result.status === 'available' ? result.item : null
    },
    contentProjection: {
      canAccessItem: permissions.canAccessItem,
      getMemberItemPermissionLevel: permissions.getMemberItemPermissionLevel,
      viewAsParticipantId: viewAsPlayerId ?? undefined,
    },
    sourceId,
  })

  return { resourceContent, search: searchSource.items }
}

type LiveItemLinkKind = 'backlinks' | 'outgoing'
type LiveItemLinksState =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'success'; links: Array<ReturnType<typeof createWizardEditorCatalogItemLink>> }

function useLiveItemLinksState({
  itemId,
  kind,
}: {
  itemId: ResourceId | null
  kind: LiveItemLinkKind
}): LiveItemLinksState {
  const persistedItemId = isPersistedWizardEditorItemId(itemId) ? itemId : null
  const backlinkRows = useCampaignQuery(
    api.links.queries.getBacklinkPanelRows,
    persistedItemId && kind === 'backlinks' ? { itemId: persistedItemId } : 'skip',
  )
  const outgoingRows = useCampaignQuery(
    api.links.queries.getOutgoingLinkPanelRows,
    persistedItemId && kind === 'outgoing' ? { noteId: persistedItemId } : 'skip',
  )
  const rows = kind === 'backlinks' ? backlinkRows : outgoingRows

  if (rows.isPending) return { status: 'pending' }
  if (rows.isError) return { status: 'error' }

  return {
    status: 'success',
    links: (rows.data ?? []).map(createWizardEditorCatalogItemLink),
  }
}
