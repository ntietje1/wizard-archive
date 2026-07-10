import { useMemo } from 'react'
import { api } from 'convex/_generated/api'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type { WorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { projectLiveSidebarItems } from './project-live-sidebar-item'

type LiveSidebarItemsLoadStatus = 'pending' | 'error' | 'success'

const EMPTY_LIVE_SIDEBAR_ITEMS: Array<WizardEditorItem> = []

interface LiveSidebarItemsQuery {
  data: Array<WizardEditorItem>
  readModel: WorkspaceResourceReadModel<WizardEditorItem>
  status: LiveSidebarItemsLoadStatus
  error: Error | null
  refresh: () => Promise<unknown>
}

type LiveSidebarItemsQueries = {
  active: LiveSidebarItemsQuery
  trash: LiveSidebarItemsQuery
}

export const useLiveSidebarItemsQueries = (): LiveSidebarItemsQueries => {
  const { campaignId: workspaceRecordId } = useCampaign()
  const result = useAuthQuery(
    api.sidebarItems.queries.getSidebarItems,
    workspaceRecordId ? { campaignId: workspaceRecordId } : 'skip',
  )
  const activeData = useMemo(
    () =>
      result.data
        ? projectLiveSidebarItems<WizardEditorItem>(result.data.active)
        : EMPTY_LIVE_SIDEBAR_ITEMS,
    [result.data],
  )
  const trashData = useMemo(
    () =>
      result.data
        ? projectLiveSidebarItems<WizardEditorItem>(result.data.trash)
        : EMPTY_LIVE_SIDEBAR_ITEMS,
    [result.data],
  )
  const activeReadModel = useMemo(() => createWorkspaceResourceReadModel(activeData), [activeData])
  const trashReadModel = useMemo(() => createWorkspaceResourceReadModel(trashData), [trashData])

  return useMemo(
    () => ({
      active: {
        data: activeData,
        readModel: activeReadModel,
        status: result.status,
        error: result.error,
        refresh: result.refetch,
      },
      trash: {
        data: trashData,
        readModel: trashReadModel,
        status: result.status,
        error: result.error,
        refresh: result.refetch,
      },
    }),
    [
      activeData,
      activeReadModel,
      result.error,
      result.refetch,
      result.status,
      trashData,
      trashReadModel,
    ],
  )
}
