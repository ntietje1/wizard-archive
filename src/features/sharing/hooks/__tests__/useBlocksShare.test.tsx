import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBlocksShare } from '../useBlocksShare'
import { createCampaign } from '~/test/factories/campaign-factory'
import { createGameMap, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { CustomBlock } from 'convex/blocks/types'
import type { NoteWithContent } from 'convex/notes/types'
import type { ReactNode } from 'react'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const convexActionMock = vi.hoisted(() => vi.fn())
const currentItemState = vi.hoisted(() => ({
  item: null as unknown,
}))
const campaignState = vi.hoisted(() => ({
  campaign: null as unknown,
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    blocks: {
      queries: { getBlocksWithShares: 'getBlocksWithShares' },
    },
    blockShares: {
      actions: {
        setBlocksShareStatus: 'setBlocksShareStatus',
        shareBlocks: 'shareBlocks',
        unshareBlocks: 'unshareBlocks',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({
    action: convexActionMock,
  }),
}))

vi.mock('~/features/sidebar/hooks/useCurrentItem', () => ({
  useCurrentItem: () => currentItemState,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: campaignState.campaign },
    campaignId: 'campaign-id',
  }),
}))

describe('useBlocksShare', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    convexActionMock.mockReset()
    convexActionMock.mockResolvedValue(null)
    currentItemState.item = createGameMap({ _id: testId<'sidebarItems'>('canvas-id') })
    campaignState.campaign = createCampaign({ _id: testId<'campaigns'>('campaign-id') })
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [], playerMembers: [] },
      isPending: false,
    })
  })

  it('queries block shares for the provided embedded note instead of the current canvas item', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const useBlocksShareForNote = useBlocksShare as unknown as (
      blocks: Array<CustomBlock>,
      note: NoteWithContent,
    ) => ReturnType<typeof useBlocksShare>

    renderHook(() => useBlocksShareForNote([block], note), { wrapper: createQueryWrapper() })

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', {
      noteId: note._id,
      blockNoteIds: ['block-1'],
    })
  })

  it('uses projection-aware block share actions', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [{ blockNoteId: 'block-1', shareStatus: null }], playerMembers: [] },
      isPending: false,
    })

    const { result } = renderHook(() => useBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    await act(async () => {
      await result.current.toggleShareStatus()
    })

    expect(convexActionMock).toHaveBeenCalledWith('setBlocksShareStatus', {
      campaignId: 'campaign-id',
      noteId: note._id,
      blockNoteIds: ['block-1'],
      status: 'all_shared',
    })
  })
})

function createBlock(id: string): CustomBlock {
  return { id, type: 'paragraph', content: [] } as unknown as CustomBlock
}

function createQueryWrapper() {
  const queryClient = new QueryClient()
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createNoteWithContent(): NoteWithContent {
  return {
    ...createNote({ _id: testId<'sidebarItems'>('embedded-note-id') }),
    ancestors: [],
    content: [],
    blockMeta: {},
  }
}
