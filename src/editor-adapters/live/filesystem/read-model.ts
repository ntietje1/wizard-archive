import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { filterWizardEditorItemsForActor } from '@wizard-archive/editor/adapter'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import { useLiveSidebarItemsQueries } from '../sidebar/use-live-sidebar-items-queries'
import { toEditorWorkspaceActor } from '../workspace-actor'

export function useFileSystemReadModel() {
  const { active, trash } = useLiveSidebarItemsQueries()
  const campaignActor = useCampaignActor()
  const actor = toEditorWorkspaceActor(campaignActor)
  const allKnownReadModel = createWorkspaceResourceReadModel([...active.data, ...trash.data])
  const visibleActive = filterWizardEditorItemsForActor(active, actor)
  const visibleTrash = filterWizardEditorItemsForActor(
    { ...trash, readModel: allKnownReadModel },
    actor,
  )
  const allItems = [...visibleActive.data, ...visibleTrash.data]
  const readModel = createWorkspaceResourceReadModel(allItems)

  return {
    activeItems: active.data,
    activeStatus: active.status,
    activeError: active.error instanceof Error ? active.error : null,
    refreshActive: active.refresh,
    visibleActiveItems: visibleActive.data,
    visibleTrashItems: visibleTrash.data,
    trashError: trash.error instanceof Error ? trash.error : null,
    refreshTrash: trash.refresh,
    trashStatus: trash.status,
    allItems,
    readModel,
  }
}

export type LiveFileSystemReadModel = ReturnType<typeof useFileSystemReadModel>
