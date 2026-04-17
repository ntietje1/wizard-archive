import { useNavigate } from '@tanstack/react-router'
import type { SidebarItemSlug } from 'convex/sidebarItems/slug'
import { useLastEditorItem } from './useLastEditorItem'
import { EDITOR_ROUTE } from './useEditorLinkProps'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export const useEditorNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const routeParams = { dmUsername, campaignSlug }

  const navigateToEditor = async (
    search: EditorSearch | ((prev: EditorSearch) => EditorSearch),
    replace?: boolean,
  ) => {
    await navigate({
      to: EDITOR_ROUTE,
      params: routeParams,
      search,
      replace,
    })
  }

  const navigateToItem = async (slug: SidebarItemSlug, replace?: boolean) => {
    setLastSelectedItem(slug)
    await navigateToEditor({ item: slug }, replace)
  }

  const clearEditorContent = async () => {
    await navigateToEditor({})
    setLastSelectedItem(null)
  }

  const navigateToTrash = async () => {
    await navigateToEditor({ trash: true })
  }

  return {
    navigateToItem,
    clearEditorContent,
    navigateToTrash,
  }
}
