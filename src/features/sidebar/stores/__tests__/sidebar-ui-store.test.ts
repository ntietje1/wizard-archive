import { beforeEach, describe, expect, it } from 'vitest'
import { assertSidebarItemSlug } from 'convex/sidebarItems/slug'
import {
  useCampaignSidebarActions,
  useSidebarUIStore,
} from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

const campaignId = 'campaign_1'

beforeEach(() => {
  resetSidebarUIStore()
})

describe('folder states', () => {
  it('setFolderState opens a folder', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates['folder_1']).toBe(true)
  })

  it('setFolderState closes a folder', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', false)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates['folder_1']).toBe(false)
  })

  it('toggleFolderState toggles between open and closed', () => {
    useSidebarUIStore.getState().toggleFolderState(campaignId, 'folder_1')
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )

    useSidebarUIStore.getState().toggleFolderState(campaignId, 'folder_1')
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      false,
    )
  })

  it('clearAllFolderStates resets all folders for a campaign', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_2', true)
    useSidebarUIStore.getState().clearAllFolderStates(campaignId)
    const state = useSidebarUIStore.getState().campaignStates[campaignId]
    expect(state.folderStates).toEqual({})
  })

  it('folder states are isolated per campaign', () => {
    useSidebarUIStore.getState().setFolderState(campaignId, 'folder_1', true)
    useSidebarUIStore.getState().setFolderState('campaign_2', 'folder_1', false)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )
    expect(useSidebarUIStore.getState().campaignStates['campaign_2'].folderStates['folder_1']).toBe(
      false,
    )
  })
})

describe('closeAllFoldersMode', () => {
  it('toggleCloseAllFoldersMode toggles the mode', () => {
    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(true)

    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(false)
  })

  it('exitCloseAllMode sets mode to false', () => {
    useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId)
    useSidebarUIStore.getState().exitCloseAllMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].closeAllFoldersMode).toBe(false)
  })
})

describe('bookmarksOnlyMode', () => {
  it('toggleBookmarksOnlyMode toggles the mode', () => {
    useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].bookmarksOnlyMode).toBe(true)

    useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].bookmarksOnlyMode).toBe(false)
  })
})

describe('selection', () => {
  it('setSelected updates selectedSlug', () => {
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('my-note'))
    expect(useSidebarUIStore.getState().selectedSlug).toBe('my-note')
  })

  it('setSelected no-ops for same slug', () => {
    const slug = assertSidebarItemSlug('my-note')
    useSidebarUIStore.getState().setSelected(slug)
    const stateBefore = useSidebarUIStore.getState()
    useSidebarUIStore.getState().setSelected(slug)
    const stateAfter = useSidebarUIStore.getState()
    expect(stateBefore).toBe(stateAfter)
  })

  it('setSelected to null clears selection', () => {
    useSidebarUIStore.getState().setSelected(assertSidebarItemSlug('my-note'))
    useSidebarUIStore.getState().setSelected(null)
    expect(useSidebarUIStore.getState().selectedSlug).toBeNull()
  })
})

describe('renaming', () => {
  it('setRenamingId and setPendingItemName update state', () => {
    useSidebarUIStore.getState().setRenamingId(testId<'sidebarItems'>('note_1'))
    useSidebarUIStore.getState().setPendingItemName('New Name')
    expect(useSidebarUIStore.getState().renamingId).toBe('note_1')
    expect(useSidebarUIStore.getState().pendingItemName).toBe('New Name')
  })
})

describe('viewAsPlayerId', () => {
  it('sets and clears viewAsPlayerId', () => {
    const playerId = testId<'campaignMembers'>('member_view')
    useSidebarUIStore.getState().setViewAsPlayerId(playerId)
    expect(useSidebarUIStore.getState().viewAsPlayerId).toBe(playerId)

    useSidebarUIStore.getState().setViewAsPlayerId(null)
    expect(useSidebarUIStore.getState().viewAsPlayerId).toBeNull()
  })
})

describe('useCampaignSidebarActions', () => {
  it('returns noop functions when campaignId is undefined', () => {
    const actions = useCampaignSidebarActions(undefined)
    actions.setFolderState('folder_1', true)
    actions.toggleFolderState('folder_1')
    actions.clearAllFolderStates()
    actions.toggleCloseAllFoldersMode()
    actions.exitCloseAllMode()
    actions.toggleBookmarksOnlyMode()
    expect(useSidebarUIStore.getState().campaignStates).toEqual({})
  })

  it('returns working functions when campaignId is provided', () => {
    const actions = useCampaignSidebarActions(campaignId)
    actions.setFolderState('folder_1', true)
    expect(useSidebarUIStore.getState().campaignStates[campaignId].folderStates['folder_1']).toBe(
      true,
    )
  })
})
