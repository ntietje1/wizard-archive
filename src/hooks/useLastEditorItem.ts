import { useCampaign } from './useCampaign'
import usePersistedState from './usePersistedState'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { EditorSearch } from '~/components/notes-page/validate-search'

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
