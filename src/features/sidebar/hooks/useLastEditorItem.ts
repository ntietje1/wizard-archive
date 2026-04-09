import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '~/shared/hooks/usePersistedState'

export function useLastEditorItem() {
  const { campaignId } = useCampaign()

  const [lastSelectedItem, setLastSelectedItem] = usePersistedState<string | null>(
    campaignId ? `last-editor-item-${campaignId}` : null,
    null,
  )

  const lastSelectedItemSearch: EditorSearch | undefined = lastSelectedItem
    ? { item: lastSelectedItem }
    : undefined

  return {
    lastSelectedItem,
    lastSelectedItemSearch,
    setLastSelectedItem,
  }
}
