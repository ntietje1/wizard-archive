import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'

function parseStoredLastSelectedItem(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function useLastWorkspaceItem() {
  const { campaignId: workspaceRecordId } = useCampaign()

  const [storedLastSelectedItem, setStoredLastSelectedItem] = usePersistedState<string | null>(
    workspaceRecordId ? `last-editor-item-${workspaceRecordId}` : null,
    null,
    parseStoredLastSelectedItem,
  )
  const lastSelectedItem: WizardEditorResourceSlug | null = storedLastSelectedItem
    ? parseWizardEditorResourceSlug(storedLastSelectedItem)
    : null

  const setLastSelectedItem = (value: WizardEditorResourceSlug | null) => {
    setStoredLastSelectedItem(value)
  }

  const lastSelectedWorkspaceItemSearch: WorkspaceRouteSearch | undefined = lastSelectedItem
    ? { item: lastSelectedItem }
    : undefined

  return {
    lastSelectedItem,
    lastSelectedWorkspaceItemSearch,
    setLastSelectedItem,
  }
}
