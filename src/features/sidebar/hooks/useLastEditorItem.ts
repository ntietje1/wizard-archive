import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '~/features/shared/hooks/usePersistedState'

export function useLastEditorItem() {
  const { campaignId } = useCampaign()

  const [lastSelectedItem, setLastSelectedItem] = usePersistedState<{
    type: SidebarItemType
    slug: string
  } | null>(campaignId ? `last-editor-item-${campaignId}` : null, null)

  const lastSelectedItemSearch: EditorSearch | undefined = lastSelectedItem
    ? { [lastSelectedItem.type]: lastSelectedItem.slug }
    : undefined

  return {
    lastSelectedItem,
    lastSelectedItemSearch,
    setLastSelectedItem,
  }
}
