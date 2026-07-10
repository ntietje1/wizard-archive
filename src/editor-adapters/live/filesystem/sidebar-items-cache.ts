import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  mergeProjectedItemsIntoLiveRows,
  projectLiveSidebarItems,
} from '../sidebar/project-live-sidebar-item'

type LiveSidebarQueryRow = Record<string, unknown> & { id?: unknown; type?: string }

type LiveSidebarQueryRows = {
  active: Array<LiveSidebarQueryRow>
  trash: Array<LiveSidebarQueryRow>
}

type LiveSidebarItemsCacheSnapshot = {
  sidebar: Array<WizardEditorItem>
  trash: Array<WizardEditorItem>
}

const EMPTY_LIVE_SIDEBAR_QUERY_ROWS: LiveSidebarQueryRows = { active: [], trash: [] }

export function useLiveSidebarItemsCache() {
  const { campaignId: workspaceRecordId } = useCampaign()
  const queryClient = useQueryClient()

  const getQueryKey = () => {
    if (!workspaceRecordId) return null
    return convexQuery(api.sidebarItems.queries.getSidebarItems, {
      campaignId: workspaceRecordId,
    }).queryKey
  }

  const getRows = (): LiveSidebarQueryRows => {
    const key = getQueryKey()
    if (!key) return EMPTY_LIVE_SIDEBAR_QUERY_ROWS
    return queryClient.getQueryData<LiveSidebarQueryRows>(key) ?? EMPTY_LIVE_SIDEBAR_QUERY_ROWS
  }

  const getSnapshot = (): LiveSidebarItemsCacheSnapshot => {
    const rows = getRows()
    return {
      sidebar: projectLiveSidebarItems<WizardEditorItem>(rows.active),
      trash: projectLiveSidebarItems<WizardEditorItem>(rows.trash),
    }
  }

  const replaceSnapshot = (
    updater: (prev: LiveSidebarItemsCacheSnapshot) => LiveSidebarItemsCacheSnapshot,
  ) => {
    const key = getQueryKey()
    if (!key) return
    const rows = getRows()
    const next = updater({
      sidebar: projectLiveSidebarItems<WizardEditorItem>(rows.active),
      trash: projectLiveSidebarItems<WizardEditorItem>(rows.trash),
    })
    queryClient.setQueryData(key, {
      active: mergeProjectedItemsIntoLiveRows(rows.active, next.sidebar),
      trash: mergeProjectedItemsIntoLiveRows(rows.trash, next.trash),
    })
  }

  return { getSnapshot, replaceSnapshot }
}
