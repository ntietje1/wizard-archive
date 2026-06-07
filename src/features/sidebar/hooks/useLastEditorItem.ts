import { parseSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '~/shared/hooks/usePersistedState'

function parseStoredLastSelectedItem(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function useLastEditorItem() {
  const { campaignId } = useCampaign()

  const [storedLastSelectedItem, setStoredLastSelectedItem] = usePersistedState<string | null>(
    campaignId ? `last-editor-item-${campaignId}` : null,
    null,
    parseStoredLastSelectedItem,
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
