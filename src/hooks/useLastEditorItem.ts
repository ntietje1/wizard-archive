import { useCampaign } from './useCampaign'
import usePersistedState from './usePersistedState'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import type { SidebarItemType } from 'convex/sidebarItems/types'

export function useLastEditorItem() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

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
