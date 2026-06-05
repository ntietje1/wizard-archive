import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { getCampaignActorViewAsMemberId } from 'shared/campaigns/actor'
import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { getCampaignMemberDisplayName } from '~/shared/utils/user-display-name'

type SidebarItemAvailabilitySubject = 'item' | 'page'

type SidebarItemAvailabilityLookup =
  | { kind: 'id'; id: Id<'sidebarItems'> | null | undefined }
  | { kind: 'slug'; slug: string | null | undefined }

export type SidebarItemAvailabilityState =
  | {
      status: 'loading'
      label: string
      item?: undefined
      message?: undefined
    }
  | {
      status: 'available'
      label: string
      item: AnySidebarItemWithContent
      message?: undefined
    }
  | {
      status: 'not_shared' | 'not_found' | 'not_found_or_not_shared' | 'error'
      label: string
      item?: undefined
      message: string
    }

interface UseSidebarItemAvailabilityStateArgs {
  lookup: SidebarItemAvailabilityLookup
  readableItem: AnySidebarItemWithContent | null | undefined
  canView: boolean
  subject: SidebarItemAvailabilitySubject
  fallbackLabel: string
  readableItemLoading?: boolean
  readableItemError?: unknown
}

export function useSidebarItemAvailabilityState({
  lookup,
  readableItem,
  readableItemLoading = false,
  readableItemError,
  canView,
  subject,
  fallbackLabel,
}: UseSidebarItemAvailabilityStateArgs): SidebarItemAvailabilityState {
  const { isDm } = useCampaign()
  const campaignActor = useCampaignActor()
  const viewAsPlayerId = getCampaignActorViewAsMemberId(campaignActor)
  const campaignMembersQuery = useCampaignMembers()
  const activeItems = useActiveSidebarItems()
  const metadata = findAvailabilityMetadata(lookup, activeItems)
  const label = metadata?.name ?? readableItem?.name ?? fallbackLabel

  if (readableItem && canView) {
    return {
      status: 'available',
      item: readableItem,
      label,
    }
  }

  if (readableItemError) {
    return {
      status: 'error',
      label,
      message: `Failed to load ${subject}: ${getErrorMessage(readableItemError)}`,
    }
  }

  if (readableItemLoading || activeItems.status === 'pending') {
    return {
      status: 'loading',
      label,
    }
  }

  if (metadata) {
    return {
      status: 'not_shared',
      label,
      message: `This ${subject} isn't shared with ${resolveAccessTarget({
        viewAsPlayerId,
        members: campaignMembersQuery.data,
      })}.`,
    }
  }

  if (activeItems.status === 'error') {
    return {
      status: 'error',
      label,
      message: `Failed to load ${subject}.`,
    }
  }

  if (isDm) {
    return {
      status: 'not_found',
      label,
      message: `This ${subject} doesn't exist.`,
    }
  }

  return {
    status: 'not_found_or_not_shared',
    label,
    message: `This ${subject} doesn't exist or isn't shared with you.`,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function findAvailabilityMetadata(
  lookup: SidebarItemAvailabilityLookup,
  activeItems: {
    data: Array<AnySidebarItem>
    itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  },
) {
  if (lookup.kind === 'id') {
    return lookup.id ? activeItems.itemsMap.get(lookup.id) : undefined
  }

  return lookup.slug ? activeItems.data.find((item) => item.slug === lookup.slug) : undefined
}

function resolveAccessTarget({
  viewAsPlayerId,
  members,
}: {
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  members:
    | Array<{
        _id: Id<'campaignMembers'>
        userProfile: { name?: string | null; username?: string | null }
      }>
    | undefined
}) {
  if (!viewAsPlayerId) {
    return 'you'
  }

  const member = members?.find((candidate) => candidate._id === viewAsPlayerId)
  if (!member) {
    return 'you'
  }

  return getCampaignMemberDisplayName(member, 'you')
}
