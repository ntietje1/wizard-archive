import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type {
  EmbedSidebarItemResolver,
  EmbedSidebarItemResolverProps,
} from '../context/embed-sidebar-item-resolution'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import type { Id } from 'convex/_generated/dataModel'

export const LiveSidebarItemEmbedResolver: EmbedSidebarItemResolver = ({ target, children }) => {
  if (target.kind !== 'sidebarItem') {
    return <>{children(undefined)}</>
  }

  return <LiveResolvedSidebarItemEmbed target={target}>{children}</LiveResolvedSidebarItemEmbed>
}

function LiveResolvedSidebarItemEmbed({
  children,
  target,
}: {
  target: Extract<EmbedTarget, { kind: 'sidebarItem' }>
  children: EmbedSidebarItemResolverProps['children']
}) {
  const targetItemId = target.sidebarItemId as Id<'sidebarItems'>
  const contentQuery = useSidebarItemById(targetItemId)
  const itemState = useSidebarItemAvailabilityState({
    lookup: { kind: 'id', id: targetItemId },
    readableItem: contentQuery.data,
    readableItemLoading: contentQuery.isLoading,
    readableItemError: contentQuery.error,
    canView: contentQuery.data != null,
    subject: 'item',
    fallbackLabel: 'Embedded item',
  })

  return <>{children(itemState)}</>
}
