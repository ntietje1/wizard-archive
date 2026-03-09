import { useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { SidebarRow } from './sidebar-row'
import { useCampaign } from '~/hooks/useCampaign'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { EDITOR_ROUTE } from '~/hooks/useEditorLinkProps'
import { Plus } from '~/lib/icons'

export function NewButton() {
  const { dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const handleNewClick = useCallback(() => {
    setLastSelectedItem(null)
  }, [setLastSelectedItem])

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
