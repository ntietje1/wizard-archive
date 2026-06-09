import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveEmbedContent } from '../live-embed-content'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { testId } from '~/test/helpers/test-id'
import { createNote } from '~/test/factories/sidebar-item-factory'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

const activeItemsState = vi.hoisted(() => ({
  data: [] as Array<AnySidebarItem>,
  itemsMap: new Map<Id<'sidebarItems'>, AnySidebarItem>(),
  status: 'success' as 'pending' | 'error' | 'success',
}))
const contentItemState = vi.hoisted(() => ({
  data: null as AnySidebarItemWithContent | null,
  isLoading: false,
  error: null as unknown,
}))
const campaignState = vi.hoisted(() => ({
  campaignId: 'campaign-1' as Id<'campaigns'> | undefined,
  isDm: true as boolean | undefined,
}))
const viewAsState = vi.hoisted(() => ({
  viewAsPlayer: null as { campaignId: Id<'campaigns'>; memberId: Id<'campaignMembers'> } | null,
  setViewAsPlayer: vi.fn(),
}))
const campaignMembersState = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: () => contentItemState,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useSidebarUIStore: (selector: (state: typeof viewAsState) => unknown) => selector(viewAsState),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => campaignMembersState,
}))

describe('LiveEmbedContent', () => {
  beforeEach(() => {
    const item = createContentItem()
    activeItemsState.data = [item]
    activeItemsState.itemsMap = new Map([[item._id, item]])
    activeItemsState.status = 'success'
    contentItemState.data = item
    contentItemState.isLoading = false
    contentItemState.error = null
    campaignState.campaignId = 'campaign-1' as Id<'campaigns'>
    campaignState.isDm = true
    viewAsState.viewAsPlayer = null
    viewAsState.setViewAsPlayer.mockReset()
    campaignMembersState.data = []
  })

  it('shows request-access copy for DM view-as when the embedded sidebar item is not shared', () => {
    viewAsState.viewAsPlayer = {
      campaignId: testId<'campaigns'>('campaign-1'),
      memberId: testId<'campaignMembers'>('player-1'),
    }
    campaignMembersState.data = [
      {
        _id: testId<'campaignMembers'>('player-1'),
        campaignId: testId<'campaigns'>('campaign-1'),
        role: CAMPAIGN_MEMBER_ROLE.Player,
        status: CAMPAIGN_MEMBER_STATUS.Accepted,
        userProfile: { name: 'Mina', username: 'mina' },
      },
    ]

    render(
      <LiveEmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: testId<'sidebarItems'>('note-1') }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemRenderer}
      />,
    )

    expect(screen.getByText('Secret Note')).toBeInTheDocument()
    expect(screen.getByText("This embedded item isn't shared with you")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request Access' })).toBeInTheDocument()
    expect(screen.queryByText('rendered item: Secret Note')).not.toBeInTheDocument()
  })
})

function SidebarItemRenderer({ item }: { item: AnySidebarItemWithContent }) {
  return <div>rendered item: {item.name}</div>
}

function createContentItem(): AnySidebarItemWithContent {
  const note = createNote({
    _id: testId<'sidebarItems'>('note-1'),
    name: 'Secret Note',
    slug: 'secret-note',
    campaignId: testId<'campaigns'>('campaign-1'),
    allPermissionLevel: PERMISSION_LEVEL.NONE,
    shares: [],
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    parentId: null,
  })

  return {
    ...note,
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  }
}
