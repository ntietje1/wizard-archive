import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SidebarRow } from './sidebar-row'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { EDITOR_ROUTE } from '~/features/sidebar/hooks/useEditorLinkProps'

export function NewButton() {
  const { dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const handleNewClick = () => {
    setLastSelectedItem(null)
  }

  return (
    <Link
      to={EDITOR_ROUTE}
      params={{ dmUsername, campaignSlug }}
      search={{}}
      className="block"
      onClick={handleNewClick}
      draggable={false}
    >
      <SidebarRow icon={Plus} label="New" className="select-none" />
    </Link>
  )
}
