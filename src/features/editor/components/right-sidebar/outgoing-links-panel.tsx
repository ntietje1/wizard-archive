import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { LinkListPanel, LinkPanelError, LinkPanelLoading } from './link-list-panel'

export function OutgoingLinksPanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const linksQuery = useCampaignQuery(api.links.queries.getOutgoingLinkPanelRows, {
    noteId: itemId,
  })
  const { navigateToItem } = useEditorNavigation()

  if (linksQuery.isPending) return <LinkPanelLoading label="outgoing links" />
  if (linksQuery.isError) return <LinkPanelError label="outgoing links" />

  return (
    <LinkListPanel
      rows={linksQuery.data ?? []}
      emptyTitle="No outgoing links"
      emptyDescription="This note does not link to other notes yet"
      onNavigate={navigateToItem}
    />
  )
}
