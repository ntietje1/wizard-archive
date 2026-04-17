import { parseSidebarItemSlug } from 'convex/sidebarItems/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/slug'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '~/shared/hooks/usePersistedState'

export function useLastEditorItem() {
  const { campaignId } = useCampaign()

  const [storedLastSelectedItem, setStoredLastSelectedItem] = usePersistedState<string | null>(
    campaignId ? `last-editor-item-${campaignId}` : null,
    null,
  )
  const lastSelectedItem: SidebarItemSlug | null =
    typeof storedLastSelectedItem === 'string' ? parseSidebarItemSlug(storedLastSelectedItem) : null

  const setLastSelectedItem = (value: SidebarItemSlug | null) => {
    setStoredLastSelectedItem(value)
  }

  const lastSelectedItemSearch: EditorSearch | undefined = lastSelectedItem
    ? { item: lastSelectedItem }
    : undefined

  return {
    lastSelectedItem,
    lastSelectedItemSearch,
    setLastSelectedItem,
  }
}
