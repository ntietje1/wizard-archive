import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBlocksShare } from '../useBlocksShare'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'
import type { ReactNode } from 'react'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const convexActionMock = vi.hoisted(() => vi.fn())
const campaignState = vi.hoisted(() => ({
  isDm: true,
  campaignId: 'campaign-id' as string | undefined,
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

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: campaignState.campaignId,
    isDm: campaignState.isDm,
  }),
}))

describe('useBlocksShare', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    convexActionMock.mockReset()
    convexActionMock.mockResolvedValue(null)
    campaignState.isDm = true
    campaignState.campaignId = 'campaign-id'
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [], playerMembers: [] },
      isPending: false,
    })
  })

  it('queries block shares for the provided embedded note', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()

    renderHook(() => useBlocksShare([block], note), { wrapper: createQueryWrapper() })

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', {
      noteId: note._id,
      blockNoteIds: ['block-1'],
    })
  })

  it.each([
    {
      name: 'non-DMs',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent(),
      setup: () => {
        campaignState.isDm = false
      },
    },
    {
      name: 'missing campaign context',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent(),
      setup: () => {
        campaignState.campaignId = undefined
      },
    },
    {
      name: 'optimistic notes',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent('optimistic-note-1'),
      setup: () => {},
    },
    {
      name: 'empty block selections',
      blocks: [],
      note: createNoteWithContent(),
      setup: () => {},
    },
  ])('skips queries and mutations for $name', async ({ blocks, note, setup }) => {
    setup()

    const { result } = renderHook(() => useBlocksShare(blocks, note), {
      wrapper: createQueryWrapper(),
    })

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', 'skip')
    expect(result.current.canShare).toBe(false)

    await act(async () => {
      await result.current.toggleShareStatus()
      await result.current.toggleShareWithMember(testId<'campaignMembers'>('player-1'))
    })

    expect(convexActionMock).not.toHaveBeenCalled()
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

    expect(result.current.canShare).toBe(true)

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

function createNoteWithContent(id = 'embedded-note-id'): NoteWithContent {
  return {
    ...createNote({ _id: testId<'sidebarItems'>(id) }),
    ancestors: [],
    content: [],
    blockMeta: {},
  }
}
