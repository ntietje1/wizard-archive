import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { LinkListPanel, LinkPanelError, LinkPanelLoading } from './link-list-panel'

export function BackLinksPanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const linksQuery = useCampaignQuery(api.links.queries.getBacklinkPanelRows, { itemId })
  const { navigateToItem } = useEditorNavigation()

  if (linksQuery.isPending) return <LinkPanelLoading label="backlinks" />
  if (linksQuery.isError) return <LinkPanelError label="backlinks" />

  return (
    <LinkListPanel
      rows={linksQuery.data ?? []}
      emptyTitle="No backlinks"
      emptyDescription="Other notes do not link here yet"
      onNavigate={navigateToItem}
    />
  )
}
