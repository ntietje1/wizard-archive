import { RIGHT_SIDEBAR_CONTENT } from './content'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { RightSidebarContentId } from './content'
import { HistoryPanel } from './components/history'
import { LinkListPanel, LinkPanelError, LinkPanelLoading } from './components/link-list'
import { OutlinePanel } from './components/outline'
import type { RightSidebarSource } from './source'

type AvailableItemLinks = Extract<RightSidebarSource['itemLinks'], { status: 'available' }>
type ItemLinksKind = Parameters<AvailableItemLinks['getItemLinks']>[0]['kind']

export function RightSidebarPanel({
  contentId,
  itemId,
  source,
}: {
  contentId: RightSidebarContentId
  itemId: SidebarItemId
  source: RightSidebarSource
}) {
  if (contentId === RIGHT_SIDEBAR_CONTENT.history && source.history.status === 'available') {
    return <RightSidebarHistoryPanel history={source.history} itemId={itemId} />
  }

  if (contentId === RIGHT_SIDEBAR_CONTENT.backlinks && source.itemLinks.status === 'available') {
    return (
      <RightSidebarItemLinksPanel
        itemId={itemId}
        itemLinks={source.itemLinks}
        kind="backlinks"
        onNavigate={source.navigation.openItem}
        resourceContent={source.resourceContent}
      />
    )
  }

  if (contentId === RIGHT_SIDEBAR_CONTENT.outgoing && source.itemLinks.status === 'available') {
    return (
      <RightSidebarItemLinksPanel
        itemId={itemId}
        itemLinks={source.itemLinks}
        kind="outgoing"
        onNavigate={source.navigation.openItem}
        resourceContent={source.resourceContent}
      />
    )
  }

  if (contentId === RIGHT_SIDEBAR_CONTENT.outline) {
    return <RightSidebarOutlinePanel itemId={itemId} outline={source.outline} />
  }

  return null
}

function RightSidebarItemLinksPanel({
  itemId,
  itemLinks,
  kind,
  onNavigate,
  resourceContent,
}: {
  itemId: SidebarItemId
  itemLinks: AvailableItemLinks
  kind: ItemLinksKind
  onNavigate: RightSidebarSource['navigation']['openItem']
  resourceContent: RightSidebarSource['resourceContent']
}) {
  const state = itemLinks.getItemLinks({ itemId, kind })
  const label = kind === 'backlinks' ? 'backlinks' : 'outgoing links'

  if (state.status === 'pending') return <LinkPanelLoading label={label} />
  if (state.status === 'error') return <LinkPanelError label={label} />

  return (
    <LinkListPanel
      rows={state.links}
      {...getItemLinksEmptyState(kind)}
      onNavigate={onNavigate}
      resourceContent={resourceContent}
    />
  )
}

function getItemLinksEmptyState(kind: ItemLinksKind) {
  if (kind === 'backlinks') {
    return {
      emptyTitle: 'No backlinks',
      emptyDescription: 'Other notes do not link here yet',
    }
  }

  return {
    emptyTitle: 'No outgoing links',
    emptyDescription: 'This note does not link to other notes yet',
  }
}

function RightSidebarHistoryPanel({
  history,
  itemId,
}: {
  history: Extract<RightSidebarSource['history'], { status: 'available' }>
  itemId: SidebarItemId
}) {
  if (history.itemId !== itemId) return null

  return (
    <HistoryPanel
      state={history.entries.state}
      onLoadMore={history.entries.loadMore}
      onPreviewEntryChange={history.previewEntry}
      onRollbackEntry={history.requestRollback}
    />
  )
}

function RightSidebarOutlinePanel({
  itemId,
  outline,
}: {
  itemId: SidebarItemId
  outline: RightSidebarSource['outline']
}) {
  return (
    <OutlinePanel state={outline.getOutlineState(itemId)} onNavigate={outline.navigateToHeading} />
  )
}
