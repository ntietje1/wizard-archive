import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vite-plus/test'
import { DEFAULT_SORT_OPTIONS } from '../../items-persistence-contract'
import { useStoredSidebarWorkspaceState } from '../ui-store'
import { SidebarWorkspaceStateProvider } from '../workspace-state'
import type { SidebarWorkspaceState } from '../workspace-state'

let workspaceSequence = 0
const TestSidebarWorkspaceStateProvider = SidebarWorkspaceStateProvider as (props: {
  value: SidebarWorkspaceState
  children?: ReactNode
}) => ReactElement

function nextWorkspaceId() {
  workspaceSequence += 1
  return `test_workspace_${workspaceSequence}`
}

type SidebarWorkspaceSort = SidebarWorkspaceState['sort']

function createTestSort(): SidebarWorkspaceSort {
  return {
    options: DEFAULT_SORT_OPTIONS,
    setOptions: () => undefined,
  }
}

function resetSidebarWorkspaceState(state: SidebarWorkspaceState) {
  act(() => {
    state.selectionCommands.clearItemSelection()
    state.selectionCommands.setActiveItemSurface(null)
    state.selectionCommands.setFocusedItem(null)
    state.editing.setRenamingItemId(null)
    state.uiCommands.clearAllFolderStates()
    state.uiCommands.exitCloseAllMode()
    if (state.ui.bookmarksOnlyMode) {
      state.uiCommands.toggleBookmarksOnlyMode()
    }
  })
}

export function createSidebarWorkspaceStateHarness({
  workspaceId = nextWorkspaceId(),
  sort = createTestSort(),
}: {
  workspaceId?: string
  sort?: SidebarWorkspaceSort
} = {}) {
  const hook = renderHook(() => useStoredSidebarWorkspaceState({ sort, workspaceId }))
  resetSidebarWorkspaceState(hook.result.current)

  return {
    workspaceId,
    sort,
    hook,
    get current() {
      return hook.result.current
    },
    unmount: hook.unmount,
  }
}

export function createSidebarWorkspaceStateWrapper({
  workspaceId = nextWorkspaceId(),
  sort = createTestSort(),
}: {
  workspaceId?: string
  sort?: SidebarWorkspaceSort
} = {}) {
  return function SidebarWorkspaceStateTestWrapper({ children }: { children: ReactNode }) {
    const state = useStoredSidebarWorkspaceState({ sort, workspaceId })
    return createElement(TestSidebarWorkspaceStateProvider, { value: state }, children)
  }
}

export function createTestSidebarWorkspaceState(
  overrides: Partial<SidebarWorkspaceState> = {},
): SidebarWorkspaceState {
  return {
    ui: {
      folderStates: {},
      closeAllFoldersMode: false,
      bookmarksOnlyMode: false,
      ...overrides.ui,
    },
    uiCommands: {
      setFolderState: vi.fn(),
      toggleFolderState: vi.fn(),
      clearAllFolderStates: vi.fn(),
      toggleCloseAllFoldersMode: vi.fn(),
      exitCloseAllMode: vi.fn(),
      toggleBookmarksOnlyMode: vi.fn(),
      ...overrides.uiCommands,
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
      ...overrides.sort,
    },
    editing: {
      renamingItemId: null,
      setRenamingItemId: vi.fn(),
      ...overrides.editing,
    },
    selection: {
      selectedItemIds: [],
      focusedItemId: null,
      activeItemSurface: null,
      ...overrides.selection,
    },
    selectionCommands: {
      setSelectedItemIds: vi.fn(),
      selectSingleItem: vi.fn(),
      toggleItemSelection: vi.fn(),
      selectItemRange: vi.fn(),
      setFocusedItem: vi.fn(),
      moveFocus: vi.fn(),
      clearItemSelection: vi.fn(),
      normalizeContextSelection: vi.fn(),
      setActiveItemSurface: vi.fn(),
      clearSelectionForWorkspaceChange: vi.fn(),
      getSelectionSnapshot: () => ({
        selectedItemIds: [],
        anchorItemId: null,
        focusedItemId: null,
        activeItemSurface: null,
      }),
      ...overrides.selectionCommands,
    },
  }
}
