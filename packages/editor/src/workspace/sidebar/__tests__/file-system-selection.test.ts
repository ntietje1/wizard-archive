import { testResourceId } from '../../../../../../shared/test/resource-id'
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { createSidebarFileSystemSelection } from '../file-system-selection'
import { createSidebarWorkspaceStateHarness } from './test-helpers'

describe('createSidebarFileSystemSelection', () => {
  it('mirrors workspace selection commands with detached snapshots', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testResourceId('note_1')
    const mapId = testResourceId('map_1')
    const selection = createSidebarFileSystemSelection(sidebar.current)

    act(() => {
      selection.setSelectedItemIds([noteId, mapId], noteId)
    })

    expect(selection.selectedItemIds).toEqual([noteId, mapId])
    expect(selection.anchorItemId).toBe(noteId)
    expect(selection.focusedItemId).toBe(noteId)

    const snapshot = selection.getSelectionSnapshot()
    ;(snapshot.selectedItemIds as Array<unknown>).push(testResourceId('leaked_item'))

    expect(selection.selectedItemIds).toEqual([noteId, mapId])
  })

  it('selects a single item through the workspace selection contract', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testResourceId('note_1')
    const selection = createSidebarFileSystemSelection(sidebar.current)

    act(() => {
      selection.selectSingleItem(noteId)
    })

    expect(selection.selectedItemIds).toEqual([noteId])
    expect(selection.anchorItemId).toBe(noteId)
    expect(selection.focusedItemId).toBe(noteId)
  })

  it('clears selected ids and anchor without clearing focused keyboard position', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testResourceId('note_1')
    const selection = createSidebarFileSystemSelection(sidebar.current)

    act(() => {
      selection.selectSingleItem(noteId)
      selection.clearItemSelection()
    })

    expect(selection.selectedItemIds).toEqual([])
    expect(selection.anchorItemId).toBeNull()
    expect(selection.focusedItemId).toBe(noteId)
  })

  it('updates anchor and focused ids independently through adapter commands', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testResourceId('note_1')
    const mapId = testResourceId('map_1')
    const selection = createSidebarFileSystemSelection(sidebar.current)

    act(() => {
      selection.setSelectedItemIds([noteId, mapId], null)
      selection.setFocusedItem(mapId)
    })

    expect(selection.selectedItemIds).toEqual([noteId, mapId])
    expect(selection.anchorItemId).toBeNull()
    expect(selection.focusedItemId).toBe(mapId)
  })
})
